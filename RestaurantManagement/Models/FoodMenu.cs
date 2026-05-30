using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantManagement.Models
{
    public class FoodMenu
    {
        [Key]
        public int FoodId { get; set; }

        [Required(ErrorMessage = "Tên món ăn không được để trống")]
        [MaxLength(100)]
        public string Name { get; set; }

        public string Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        public string ImageUrl { get; set; }
        public bool IsDeleted { get; set; } = false;

        // 1 Món ăn có thể nằm trong nhiều OrderDetails
        public virtual ICollection<OrderDetail> OrderDetails { get; set; }
    }
}