using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs.OrderLog;
using RestaurantManagement.DTOs.Order;
using RestaurantManagement.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Query;

namespace RestaurantManagement.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        public OrderController(RestaurantManagementContext context)
        {
            _context = context;
        }

        // GET api/orders
        // Lấy danh sách đơn hàng, lọc theo filter

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll([FromQuery] string filter = "All")
        {
            var query = _context.Orders
                .Where(o => !o.IsDeleted)
                .Include(o => o.User)
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                .AsQueryable();

            // Kiểm tra nếu là Customer chỉ xem được tất cả order của họ
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var userIdClaim = User.FindFirst("UserId")?.Value;

            if (role == "Customer")
            {
                if (!int.TryParse(userIdClaim, out var userId))
                    return Unauthorized();

                query = query.Where(o => o.UserId == userId);
            }
            

            query = filter switch
            {
                "InProcessing" => query.Where(o => !o.IsFinished),
                "Unpaid"=> query.Where(o => o.PaymentStatus=="Unpaid"),
                "Paid" => query.Where(o => o.PaymentStatus == "Paid"),
                "Finished" => query.Where(o => o.IsFinished),
                _ => query
            };

            var result = await query
                .OrderByDescending(o => o.OrderDate)
                .Select(o => new OrderListDto
                {
                    OrderId = o.OrderId,
                    CustomerName = o.User.FullName,
                    OrderDate = o.OrderDate,
                    TotalAmount = o.TotalAmount,
                    PaymentStatus = o.PaymentStatus,
                    IsFinished = o.IsFinished,
                    TotalItems = o.OrderDetails.Count(od => !od.IsDeleted)
                })
                .ToListAsync();

            return Ok(result);
        }


        // GET api/orders/{id}
        // Chi tiết 1 đơn hàng + danh sách món + log mỗi món
        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetById(int id)
        {
            var order = await _context.Orders
                .Where(o => o.OrderId == id && !o.IsDeleted)
                .Include(o => o.User)
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                    .ThenInclude(od => od.FoodMenu)
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                    .ThenInclude(od => od.OrderLogs.OrderByDescending(l => l.CreatedDate))
                .FirstOrDefaultAsync();

            if (order == null)
                return NotFound(new { message = "Order not found!" });

            // Kiểm tra Customer chỉ xem được order của chính họ
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (role == "Customer")
            {
                var userIdClaim = User.FindFirst("UserId")?.Value;
                if (!int.TryParse(userIdClaim, out var userId) || order.UserId != userId)
                    return Forbid();
            }

            var result = new OrderDetailResponseDto
            {
                OrderId = order.OrderId,
                CustomerName = order.User.FullName ?? order.User.Username,
                OrderDate = order.OrderDate,
                TotalAmount = order.TotalAmount,
                PaymentStatus = order.PaymentStatus,
                IsFinished = order.IsFinished,
                Items = order.OrderDetails.Select(od => new OrderDetailItemDto
                {
                    OrderDetailId = od.OrderDetailId,
                    FoodName = od.FoodMenu.Name,
                    FoodImage = od.FoodMenu.ImageUrl,
                    Quantity = od.Quantity,
                    UnitPrice = od.UnitPrice,
                    Subtotal = od.UnitPrice * od.Quantity,
                    Status = od.Status,
                    OrderDate = od.OrderDate,
                }).ToList()
            };

            return Ok(result);
        }

        private async Task<(bool isValid, IActionResult? errorResult, Order? activeOrder)> CheckOrderAsync(int userId)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UserId == userId
                               && !u.IsDeleted
                               && u.IsActive);
            if (user == null)
                return (false, NotFound(new { message = "User Not Found." }), null);

            // 1 user chỉ có 1 order active tại 1 thời điểm
            var activeOrder = await _context.Orders
                .FirstOrDefaultAsync(o => o.UserId == userId
                               && !o.IsFinished
                               && !o.IsDeleted);

            return (true, null, activeOrder);
        }

        // POST api/orders
        // Khách bắt đầu gọi món → tạo Order mới
        // OrderLog không được tự tạo ở Order vì Log gắn với OrderDetailId,
        // Log sẽ được tạo bởi OrderDetailsController khi POST items.
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create()
        {
            var UserId = int.Parse(User.FindFirstValue("UserId"));
            var (isValid, errorResult, activeOrder) = await CheckOrderAsync(UserId);

            if (!isValid)
                return errorResult;

            if (activeOrder != null)
                return BadRequest(new
                {
                    message = "You already have an unfinished order.",
                    orderId = activeOrder.OrderId
                });

            var order = new Order
            {
                UserId = UserId,
                OrderDate = DateTime.Now,
                TotalAmount = 0,
                PaymentStatus = "Unpaid",
                IsFinished = false,
                IsDeleted = false
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = order.OrderId }, new
            {
                message = "Order create Successfully.",
                orderId = order.OrderId  // trả về để OrderDetail dùng
            });
        }

        [HttpGet("isOrder")]
        [Authorize]
        public async Task<IActionResult> IsOrder()
        {
            var userId = int.Parse(User.FindFirstValue("UserId"));
            var (isValid, errorResult, activeOrder) = await CheckOrderAsync(userId);

            if (!isValid) return errorResult!;

            if (activeOrder == null)
                return Ok(new { hasOrder = false, orderId = (int?)null });

            return Ok(new { hasOrder = true, orderId = activeOrder.OrderId });
        }

        // PUT api/orders/{id}/status
        // Nhân viên cập nhật PaymentStatus

        [HttpPut("{id}/status")]
        [Authorize(Policy ="SelfOrAdmin")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto)
        {
          
            var allowedStatuses = new[]
            {
                "Paid", "Suspended"
            };

            if (!allowedStatuses.Contains(dto.PaymentStatus))
                return BadRequest(new { message = "Invalid payment status!" });

            var order = await _context.Orders
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                .FirstOrDefaultAsync(o => o.OrderId == id && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found." });

            if (order.IsFinished && dto.PaymentStatus != "Suspended")
                return BadRequest(new { message = "Order is completed." });

            // Khách trả tiền
            if (dto.PaymentStatus == "Paid")
            {
                bool hasPending = order.OrderDetails
                    .Any(d => d.Status == "Pending" || d.Status == "Processing");

                if (hasPending)
                    return BadRequest(new { message = "The order is not completed yet, Can not process through payment." });

                order.PaymentStatus = dto.PaymentStatus;
            }

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (dto.PaymentStatus == "Suspended" && role =="Admin")
            {
                bool hasPending = order.OrderDetails
                    .Any(d => d.Status == "Pending" || d.Status == "Processing");

                if (hasPending)
                    return BadRequest(new { message = "The order is not completed yet, Can not process through payment." });

                order.PaymentStatus = dto.PaymentStatus;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Status update completed.",
                orderId = order.OrderId,
                paymentStatus = order.PaymentStatus,
                isFinished = order.IsFinished
            });
        }

        // PUT api/orders/{id}/confirm
        [HttpPut("{id}/confirm")]
        [Authorize(Policy ="Admin")]
        public async Task<IActionResult> ConfirmOrder(int id)
        {
            var order = await _context.Orders
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                .FirstOrDefaultAsync(o => o.OrderId == id && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found." });
            if (order.PaymentStatus != "Paid")
            {
                return BadRequest(new { message="Can not confirm unpaid order" });
            }
            order.IsFinished = true;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Order #{id} has been confirmed and paid.",
                orderId = order.OrderId,
                paymentStatus = order.PaymentStatus,
                isFinished = order.IsFinished
            });
        }

        // Soft delete — chỉ xóa được khi tất cả món còn Pending
        [HttpDelete("{id}")]
        [Authorize("AdminOrChef")]
        public async Task<IActionResult> Delete(int id)
        {
            var order = await _context.Orders
                .Include(o => o.OrderDetails)
                .FirstOrDefaultAsync(o => o.OrderId == id && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found!" });

            bool hasProcessing = order.OrderDetails
                .Any(d => !d.IsDeleted &&
                         (d.Status == "Processing" || d.Status == "Completed"));

            if (hasProcessing)
                return BadRequest(new { message = "This order is already in process/completed, it can't be deleted!" });

            // Soft delete

            order.IsDeleted = true;
            foreach (var detail in order.OrderDetails)
                detail.IsDeleted = true;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Order deleted!" });
        }
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