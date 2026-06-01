using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs.OrderLog;
using RestaurantManagement.DTOs.Order;
using RestaurantManagement.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace RestaurantManagement.Controllers
{
    [ApiController]
    [Route("api/order")]
    public class OrdersController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        public OrdersController(RestaurantManagementContext context)
        {
            _context = context;
        }

        // GET api/orders
        // Lấy danh sách đơn hàng, lọc theo filter
     
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll([FromQuery] string filter = "InProcessing")
        {
            var query = _context.Orders
                .Where(o => !o.IsDeleted)
                .Include(o => o.User)
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                .AsQueryable();

            // Kiểm tra nếu là Customer chỉ xem được tất cả order của họ
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var userIdClaim = User.FindFirst("UserId")?.Value;

            if(role == "Customer")
            {
                if (!int.TryParse(userIdClaim, out var userId))
                    return Unauthorized();

                query = query.Where(o => o.UserId == userId);
            }

            query = filter switch
            {
                "InProcessing" => query.Where(o => !o.IsFinished),
                "checkout" => query.Where(o => o.PaymentStatus == "CheckoutRequested"),
                "finished" => query.Where(o => o.IsFinished),
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
                    FoodName = od.FoodMenu?.Name,
                    FoodImage = od.FoodMenu?.ImageUrl,
                    Quantity = od.Quantity,
                    UnitPrice = od.UnitPrice,
                    Subtotal = od.UnitPrice * od.Quantity,
                    Status = od.Status,
                    OrderDate = od.OrderDate,
                    Logs = od.OrderLogs.Select(l => new Log
                    {
                        LogId = l.LogId,
                        Status = l.Status,
                        CreatedDate = l.CreatedDate
                    }).ToList()
                }).ToList()
            };

            return Ok(result);
        }
        // POST api/orders
        // Khách bắt đầu gọi món → tạo Order mới
        // OrderLog không được tự tạo ở Order vì Log gắn với OrderDetailId,
        // Log sẽ được tạo bởi OrderDetailsController khi POST items.
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create()
        {
            var UserId = int.Parse(User.FindFirstValue("UserId")); // sẽ chạy được khi có Authentication

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UserId == UserId
                                       && !u.IsDeleted
                                       && u.IsActive);
            if (user == null)
                return NotFound(new { message = "User Not Found." });

            // 1 user chỉ có 1 order active tại 1 thời điểm
            var exist = await _context.Orders
                .FirstOrDefaultAsync(o => o.UserId == UserId
                                       && !o.IsFinished
                                       && !o.IsDeleted);
            if (exist != null)
                return BadRequest(new
                {
                    message = "You already have an unfinished order.",
                    orderId = exist.OrderId
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

        // PUT api/orders/{id}/status
        // Nhân viên cập nhật PaymentStatus
 
        [HttpPut("{id}/status")]
        [Authorize(Policy ="AdminOrChef")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto)
        {
            var allowedStatuses = new[]
            {
                "Unpaid",  "Paid" , "Suspended"
            };

            if (!allowedStatuses.Contains(dto.PaymentStatus))
                return BadRequest(new { message = "Invalid payment status!" });

            var order = await _context.Orders
                .Include(o => o.OrderDetails.Where(od => !od.IsDeleted))
                .FirstOrDefaultAsync(o => o.OrderId == id && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found." });

            if (order.IsFinished)
                return BadRequest(new { message = "Order is completed." });

            // Chỉ cho phép trả tiền khi tất cả món đã xong (completed)
            if (dto.PaymentStatus == "Paid")
            {
                bool hasPending = order.OrderDetails
                    .Any(d => d.Status == "Pending" || d.Status == "Processing");

                if (hasPending)
                    return BadRequest(new { message = "The order is not completed yet, Can not process through payment." });

                order.IsFinished = true;
            }

            order.PaymentStatus = dto.PaymentStatus;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Status update completed.",
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
    }
}