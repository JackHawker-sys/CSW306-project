using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;
using System.Security.Claims;

namespace RestaurantManagement.Controller
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrderDetailController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        // Định nghĩa trạng thái chuyển đổi
        // Key   = Trạng thái hiện tại
        // Value = Trạng thái có thể chuyển sang
        private static readonly Dictionary<string, string[]> AllowedTransitions = new()
        {
            { "Pending",    new[] { "Processing", "Cancelled" } },
            { "Processing", new[] { "Completed" } },
            { "Completed",  Array.Empty<string>() },   // terminal state
            { "Cancelled",  Array.Empty<string>() }    // terminal state
        };

        public OrderDetailController(RestaurantManagementContext context)
        {
            _context = context;
        }

        // Trả về detail của một món trong 1 order
        // Customer chỉ xem được trong các order của họ, Admin/Chef xem được tất cả
        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetById(int id)
        {
            var detail = await _context.OrderDetails
                .Include(od => od.FoodMenu)
                .Include(o => o.Order)
                .FirstOrDefaultAsync(od => od.OrderDetailId == id && !od.IsDeleted);

            if (detail == null)
                return NotFound(new { message = "Order detail not found." });

            // Kiểm tra Customer chỉ xem được order của chính họ
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (role == "Customer")
            {
                var userIdClaim = User.FindFirst("UserId")?.Value;
                if (!int.TryParse(userIdClaim, out var userId) || detail.Order.UserId != userId)
                    return Forbid();
            }

            return Ok(ToResponse(detail));
        }

        // Trả về tất cả order detail (chưa bị xóa) của một order
        [HttpGet("order/{id}")]
        [Authorize]
        public async Task<IActionResult> GetByOrder(int id)
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.OrderId == id && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found." });

            var details = await _context.OrderDetails
                .Include(od => od.FoodMenu)
                .Where(od => od.OrderId == id && !od.IsDeleted)
                .ToListAsync();

            return Ok(details.Select(ToResponse));
        }


        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateOrderDetailsDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);
            var userId = int.Parse(User.FindFirst("UserId")?.Value);

            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.UserId == userId && !o.IsFinished);

            if (order == null)
                return NotFound(new { message = "Order not found." });

            if (order.IsFinished)
                return BadRequest(new { message = "Cannot add items to a finished order." });

            // Kiểm tra các món có trong menu không
            var foodIds = dto.Items.Select(i => i.FoodId).Distinct().ToList();

            var foods = await _context.FoodMenus
                .Where(f => foodIds.Contains(f.FoodId) && !f.IsDeleted)
                .ToDictionaryAsync(f => f.FoodId);

            var missingIds = foodIds.Except(foods.Keys).ToList();
            if (missingIds.Any())
                return NotFound(new
                {
                    message = $"Food item(s) not found or deleted: {string.Join(", ", missingIds)}"
                });

            // Step 1: Tạo detail
            var details = dto.Items.Select(item => new OrderDetail
            {
                OrderId = order.OrderId,
                FoodId = item.FoodId,
                Quantity = item.Quantity,
                UnitPrice = foods[item.FoodId].Price, // snapshot price at time of order
                Status = "Pending",
                OrderDate = DateTime.Now,
                IsDeleted = false
            }).ToList();

            _context.OrderDetails.AddRange(details);
            await _context.SaveChangesAsync(); // IDs are assigned after this

            // Step 2: Log khi cập nhật status thành Pending
            foreach (var d in details)
                _context.OrderLogs.Add(BuildLog(d.OrderDetailId, "Pending"));

            // Step 3: Tính (lại) tổng tiền cho order
            await RecalculateTotalAsync(order.OrderId, order);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"{details.Count} item(s) added to order #{order.OrderId}.",
                items = details.Select(d => new
                {
                    d.OrderDetailId,
                    d.FoodId,
                    FoodName = foods[d.FoodId].Name,
                    d.Quantity,
                    d.UnitPrice,
                    Subtotal = d.UnitPrice * d.Quantity,
                    d.Status,
                    d.OrderDate
                })
            });
        }

        // PATCH: status
        [HttpPatch("{id}/status")]
        [Authorize(Policy = "AdminOrChef")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var detail = await _context.OrderDetails
                .FirstOrDefaultAsync(od => od.OrderDetailId == id && !od.IsDeleted);

            if (detail == null)
                return NotFound(new { message = "Order detail not found." });

            // Kiểm tra xem chuyển sang trạng thái được nhập 
            if (!AllowedTransitions.TryGetValue(detail.Status, out var allowed) ||
                !allowed.Contains(dto.Status))
            {
                return BadRequest(new
                {
                    message = $"Cannot transition '{detail.Status}' → '{dto.Status}'.",
                    allowedNext = AllowedTransitions.GetValueOrDefault(detail.Status, Array.Empty<string>())
                });
            }

            detail.Status = dto.Status;
            _context.OrderLogs.Add(BuildLog(id, dto.Status));

            // Nếu status chuyển thành Cancelled thì phải loại món đó => tính tiền lại
            if (dto.Status == "Cancelled")
                await RecalculateTotalAsync(detail.OrderId);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Status updated to '{dto.Status}'.",
                detail.OrderDetailId,
                detail.Status,
                allowedNextSteps = AllowedTransitions[dto.Status]
            });
        }

        // PATCH: quantity
        [HttpPatch("{id}/quantity")]
        [Authorize(Policy = "SelfOrAdmin")]
        public async Task<IActionResult> UpdateQuantity(int id, [FromBody] UpdateQuantityDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var detail = await _context.OrderDetails
                .FirstOrDefaultAsync(od => od.OrderDetailId == id && !od.IsDeleted);

            if (detail == null)
                return NotFound(new { message = "Order detail not found." });

            if (detail.Status != "Pending")
                return BadRequest(new
                {
                    message = $"Quantity can only be changed when status is 'Pending'. Current: '{detail.Status}'."
                });

            var oldQty = detail.Quantity;
            detail.Quantity = dto.Quantity;

            _context.OrderLogs.Add(BuildLog(id, $"Quantity: {oldQty} → {dto.Quantity}"));
            await RecalculateTotalAsync(detail.OrderId);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Quantity updated.",
                detail.OrderDetailId,
                OldQuantity = oldQty,
                NewQuantity = detail.Quantity,
                NewSubtotal = detail.UnitPrice * detail.Quantity
            });
        }


        [HttpDelete("{id}")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var detail = await _context.OrderDetails
                .FirstOrDefaultAsync(od => od.OrderDetailId == id && !od.IsDeleted);

            if (detail == null)
                return NotFound(new { message = "Order detail not found." });

            if (detail.Status != "Pending")
                return BadRequest(new
                {
                    message = $"Only 'Pending' items can be removed. Current status: '{detail.Status}'."
                });

            detail.IsDeleted = true;

            _context.OrderLogs.Add(BuildLog(id, "Deleted"));

            await RecalculateTotalAsync(detail.OrderId);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Order detail removed from the order." });
        }

        // Tính tổng tiền của các món chưa bị xóa
        private async Task RecalculateTotalAsync(int orderId, Order? order = null)
        {
            order ??= await _context.Orders.FindAsync(orderId);
            if (order == null) return;

            order.TotalAmount = await _context.OrderDetails
                .Where(od => od.OrderId == orderId
                          && !od.IsDeleted
                          && od.Status != "Cancelled")
                .SumAsync(od => od.UnitPrice * od.Quantity);
        }

        private static OrderLog BuildLog(int orderDetailId, string status) => new()
        {
            OrderDetailId = orderDetailId,
            Status = status,
            CreatedDate = DateTime.Now
        };

        private static object ToResponse(OrderDetail od) => new
        {
            od.OrderDetailId,
            od.OrderId,
            od.FoodId,
            FoodName = od.FoodMenu?.Name,
            od.Quantity,
            od.UnitPrice,
            Subtotal = od.UnitPrice * od.Quantity,
            od.Status,
            od.OrderDate
        };
    }
}