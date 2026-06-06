using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.DTOs
{

    public class CreateOrderDetailsDto
    {
        [Required(ErrorMessage = "At least one item is required.")]
        [MinLength(1, ErrorMessage = "At least one item is required.")]
        public List<OrderDetailItemDto> Items { get; set; }
    }

    public class OrderDetailItemDto
    {
        [Required]
        public int FoodId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; } = 1;
    }

    public class UpdateStatusDto
    {
        [Required(ErrorMessage = "Status is required.")]
        public string Status { get; set; }
    }

    public class UpdateQuantityDto
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; }
    }
}