using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace RestaurantManagement.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;
        public UserController(RestaurantManagementContext context)
        {
            _context = context;
        }

        [HttpGet("me")]
        [Authorize]
        public IActionResult GetMe()
        {
            var username = User.Identity?.Name;
            var role = User.FindFirst(ClaimTypes.Role);
            return Ok(new { username, role });
        }

        [HttpGet("dashboard")]
        [Authorize(Roles = "Admin")]
        public IActionResult GetAdminDashboard()
        {
            //Đưa code lấy dữ liệu Order về bỏ vào đây
            return Ok("Welcome admin!");
        }

        [HttpGet("active-users")]
        [Authorize(Policy = "ActiveUserOnly")]
    }
}
