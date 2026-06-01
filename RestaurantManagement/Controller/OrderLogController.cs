using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.DTOs;
using RestaurantManagement.Data;
using RestaurantManagement.Models;
namespace RestaurantManagement.Controller
{
    [ApiController]
    [Route("api/order-logs")]
    public class OrderLogController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        public OrderLogController(RestaurantManagementContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task <IActionResult> GetByOrderdetail([FromQuery] int OrderDetailId)
        {
            var detail = await _context.OrderDetails
              .Where(od => od.OrderDetailId == OrderDetailId && !od.IsDeleted)
              .Include(od => od.FoodMenu)
              .Include(od => od.Order)
              .FirstOrDefaultAsync();

            if (detail == null)
                return NotFound(new { message = "Order id does not exsits" });

            var logs = await _context.OrderLogs
                .Where(l => l.OrderDetailId == OrderDetailId)
                .OrderByDescending(l => l.CreatedDate)
                .Select(l => new OrderLog
                {
                    LogId = l.LogId,
                    Status = l.Status,
                    CreatedDate = l.CreatedDate
                })
                .ToListAsync();

            return Ok(new
            {
                orderDetailId = detail.OrderDetailId,
                orderId = detail.OrderId,
                foodName = detail.FoodMenu?.Name,
                currentStatus = detail.Status,
                logs          // timeline: Pending => Processing => Completed
            });
        }



        // Xem log của tất cả món trong 1 đơn hàng
        // Cho admin xem toàn bộ timeline của 1 order
        [HttpGet("order/{orderId}")]
        public async Task<IActionResult> GetByOrder(int orderId)
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.OrderId == orderId && !o.IsDeleted);

            if (order == null)
                return NotFound(new { message = "Order not found." });

            var details = await _context.OrderDetails
                .Where(d => d.OrderId == orderId && !d.IsDeleted)
                .Include(d => d.FoodMenu)
                .Include(d => d.OrderLogs.OrderByDescending(l => l.CreatedDate))
                .ToListAsync();

            var result = details.Select(d => new
            {
                orderDetailId = d.OrderDetailId,
                foodName = d.FoodMenu?.Name,
                currentStatus = d.Status,
                logs = d.OrderLogs.Select(l => new OrderLog
                {
                    LogId = l.LogId,
                    Status = l.Status,
                    CreatedDate = l.CreatedDate
                }).ToList()
            });

            return Ok(result);
        }
    }
}
