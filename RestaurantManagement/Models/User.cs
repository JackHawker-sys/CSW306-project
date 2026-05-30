using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Models
{
    public class User
    {
        [Key] 
        public int UserId { get; set; }

        [Required(ErrorMessage = "Username không được để trống")]
        [MaxLength(50)] 
        public string Username { get; set; }

        [Required]
        public string PasswordHash { get; set; }

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
        [MaxLength(100)]
        public string Email { get; set; }

        [MaxLength(200)]
        public string FullName { get; set; }

        [MaxLength(20)]
        public string Phone { get; set; }

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } // Admin, Customer, Chief
        public bool IsLocked { get; set; }
        public bool IsDeleted { get; set; }
        public bool IsActive { get; set; }
        public string? ActiveCode { get; set; }


        // 1 User có thể có nhiều Orders
        public virtual ICollection<Order> Orders { get; set; }
    }
}