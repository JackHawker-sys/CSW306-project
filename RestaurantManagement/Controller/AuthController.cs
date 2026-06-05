using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;
using RestaurantManagement.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
namespace RestaurantManagement.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        public AuthController(RestaurantManagementContext context, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == request.Username);
            var checkPassword = user !=null && BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);

            if (user == null || !checkPassword)
                return Unauthorized(new { message = "Invalid username or password!" });

            if (!user.IsActive)
                return Unauthorized(new { message = "User is inactive!" });

            if (user.IsDeleted)
                return Unauthorized(new { message = "User has been deleted!" });

            if (user.IsLocked)
                return Unauthorized(new { message = "User has been locked!" });

            var token = GenerateJwtToken(user);
            return Ok(new {message="Login successfully!",token =$"{token}"});
        }

        // Gửi activecode tới email
        [HttpPost("send-verification")]
        public async Task<IActionResult> SendVerification([FromBody] string email)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
                return NotFound(new { message = "Email not found." });

            await _context.SaveChangesAsync();

            // Gửi email
            await _emailService.SendVerificationCodeAsync(email, user.ActiveCode);

            return Ok(new { message = "Verification code sent." });
        }

        private string GenerateJwtToken(User user)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role,user.Role),
                new Claim("UserId", user.UserId.ToString()),
                new Claim("IsActive", (user.IsActive && user.IsDeleted == false) ? "True" : "False"),
            };

            var isAdmin = (user.Role=="Admin");
            claims.Add(new Claim("CanWatchDashboard", isAdmin.ToString()));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["JwtSettings:Issuer"],
                audience: _configuration["JwtSettings:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(60),
                signingCredentials: creds
                );
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // Tương tự send-verification nhưng có kiểm tra tính trạng tài khoản (kích hoạt, xóa, khóa)
        [HttpPost("email-verification")]
        public async Task<IActionResult> Forgot([FromBody] string Email)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == Email);
            if (user == null)
                return NotFound(new { message = "Email does not exsits." });
            
            if (!user.IsActive)
                return Unauthorized(new { message = "User is inactive!" });

            if (user.IsDeleted)
                return Unauthorized(new { message = "User has been deleted!" });

            if (user.IsLocked)
                return Unauthorized(new { message = "User has been locked!" });
           
            await _emailService.SendVerificationCodeAsync(Email, user.ActiveCode);
           
            return Ok("Active code has been sent to your email!");
        }

        // Kiểm tra active code và đổi mật khẩu mới, có kiểm tra confirm password
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPassword request)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.ActiveCode == request.ActiveCode);

            if (user == null)
                return NotFound(new { message = "Active code does not match!" });

            if (request.Password != request.ConfirmPassword)
                return BadRequest(new { message = "Password does not match!" });
            
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Password has been changed sucessfully" });

        }

    }

}
