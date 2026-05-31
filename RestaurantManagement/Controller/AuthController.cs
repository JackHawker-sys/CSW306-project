using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
namespace RestaurantManagement.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(RestaurantManagementContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = _context.Users
                .AsNoTracking()
                .FirstOrDefault(u => u.Username == request.Username);

            if(user == null)
                return Unauthorized(new { message = "Wrong user!" });

            var checkPassword = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);

            if (!checkPassword)
                return Unauthorized(new { message = "Wrong password!" });

            if (!user.IsActive)
                return Unauthorized(new { message = "User is inactive!" });

            var token = GenerateJwtToken(user);
            return Ok(new {message="Login successfully!",token =$"{token}"});
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
    }

}
