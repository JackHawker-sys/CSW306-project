using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.DTOs
{
    public class RegisterDto
    {
        [Required]
        public string Username {  get; set; }
        [Required]
        public string PasswordHash { get; set; }
        public string Fullname { get; set; }
        [Required]
        public string Email { get; set; }
        [Required]
        public string Phone { get; set; }
    }

    public class UpdateUserModel
    {
        public string? Username { get; set; } = null;
        public string? PasswordHash { get; set; } = null;
        public string? Fullname { get; set; } = null;
        public string? Email { get; set; } = null;
        public string? Phone { get; set; } = null;
    }
}
