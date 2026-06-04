using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;
using RestaurantManagement.Services;
using System.Security.Claims;


namespace RestaurantManagement.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;
        private readonly IEmailService _emailService;
        public UserController(RestaurantManagementContext context, IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMe()
        {
            var username = User.Identity?.Name;
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == username);

            return Ok(new
            {
                UserId = user.UserId,
                FullName = username,
                Role = user.Role,
                Email = user.Email,
                Phone = user.Phone
            });
        }

        [HttpGet("dashboard")]
        [Authorize(Roles = "Admin")]
        public IActionResult GetAdminDashboard()
        {
            //Đưa code lấy dữ liệu Order về bỏ vào đây
            return Ok("Welcome admin!");
        }

        // Admin xem user đang hoạt động
        [HttpGet("active-users")]
        [Authorize(Policy = "Admin")]
        public IActionResult GetActiveUsers()
        {
            var activeUser = _context.Users
                .Where(u => u.IsActive && !u.IsDeleted)
                .Select(u => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.Phone
                }).ToList();

            return Ok(activeUser);
        }

        // Đăng ký khách hàng mới
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromForm] RegisterDto register)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            bool userExists = _context.Users
                .Any(x => x.Username == register.Username);

            if (userExists)
                return Conflict(new { message = "Username is already existed." });

            bool emailExists = _context.Users
                .Any(x => x.Email == register.Email);

            if (emailExists)
                return Conflict(new { message = "Email is already existed." });

            string activeCode = Guid.NewGuid().ToString("N").ToUpper();

            var user = new User
            {
                Username = register.Username,
                FullName = register.Fullname,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(register.PasswordHash),
                Email = register.Email,
                Phone = register.Phone,
                ActiveCode = activeCode,
                Role = "Customer",
                IsActive = false,
                IsDeleted = false,
                IsLocked = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await _emailService.SendVerificationCodeAsync(user.Email, activeCode);

            return Ok(new { message = "Registration successful. Please activate your account.", activeCode });
        }

        // Chỉnh sửa thông tin khách hàng
        [HttpPut("{id}")]
        [Authorize(Policy = "SelfOrAdmin")]
        public async Task<IActionResult> Update(int id, [FromForm] UpdateUserModel model)
        {
            var currentUserIdClaim = User.FindFirst("UserId")?.Value;
            var currentRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (!int.TryParse(currentUserIdClaim, out var currentUserId))
                return Unauthorized();

            bool isAdmin = currentRole == "Admin";
            bool isSelf = currentUserId == id;

            if (!isAdmin && !isSelf)
                return Forbid();

            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.UserId == id);

            if (user == null)
                return NotFound(new { message = $"Not found userId {id}" });

            if (!string.IsNullOrWhiteSpace(model.PasswordHash))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.PasswordHash);
            }

            user.FullName = model.Fullname ?? user.FullName;
            user.Phone = model.Phone ?? user.Phone;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"User ID {id} information updated.",
                UserId = user.UserId,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone
            });
        }

        // Lock usser
        [HttpPatch("{id}/toggle-lock")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> ToggleLock(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(x => x.UserId == id);
            if (user == null)
                return NotFound(new { message = $"User ID {id} not found." });

            user.IsLocked = !user.IsLocked;
            return Ok(new
            {
                message = $"User ID {id} lock status: {user.IsLocked}."
            });
        }

        // Xóa User
        [HttpDelete("{id}")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(x => x.UserId == id);
            if (user == null)
                return NotFound(new { message = $"User ID {id} not found." });

            if (user.Role == "Admin")
                return Unauthorized(new { message = "Can not delete admin!" });

            user.IsDeleted = true;
            return Ok(new { message = $"User ID {id} has been deleted!" });
        }

        
        // Giả lập kích hoạt tài khoản
        [HttpPost("activate")]
        public async Task<IActionResult> ActivateByForm([FromBody] ActivateRequest request)
        {
            return await Activate(request.ActiveCode, request.Email);
        }
        private async Task<IActionResult> Activate(string code, string email)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.ActiveCode == code && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "Invalid activation code." });
            }

            if (user.Email != email)
                return Unauthorized(new { message = "Email is wrong." });

            if (user.IsActive)
                return BadRequest(new { message = "Account is already activated." });

            if (user.IsLocked)
                return BadRequest(new { message = "Account is locked. Please contact support." });

            user.IsActive = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Account activated successfully. You can now log in." });
        }
    }
}
