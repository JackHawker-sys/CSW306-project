using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantManagement.Models
{
    public class Table
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public int TableId { get; set; }

        [Required]
        public bool IsReady { get; set; } = true;  // true = bàn trống, sẵn sàng

        public bool IsDeleted { get; set; } = false;  // soft delete cho đồng bộ với project

        // Navigation property ngược lại (1 bàn có nhiều order theo thời gian)
        public virtual ICollection<Order> Orders { get; set; }
    }
}