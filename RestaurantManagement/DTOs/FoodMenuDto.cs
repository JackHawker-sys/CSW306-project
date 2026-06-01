using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.DTOs
{
    public class CreateFoodMenuDto
    {
        [Required(ErrorMessage = "Dish name cannot be empty")]
        [MaxLength(100, ErrorMessage = "Dish name cannot exceed 100 characters")]
        public string Name { get; set; }

        public string? Description { get; set; }

        [Required(ErrorMessage = "Price is required")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Price must be positive")]
        public decimal Price { get; set; }

        public IFormFile? Image { get; set; }
    }

    public class UpdateFoodMenuDto
    {
        [Required(ErrorMessage = "Dish name cannot be empty")]
        [MaxLength(100, ErrorMessage = "Dish name cannot exceed 100 characters")]
        public string Name { get; set; }

        public string? Description { get; set; }

        [Required(ErrorMessage = "Price is required")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
        public decimal Price { get; set; }

        public IFormFile? Image { get; set; }
    }
}