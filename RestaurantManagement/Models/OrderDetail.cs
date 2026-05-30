using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantManagement.Models
{
    public class OrderDetail
    {
        [Key]
        public int OrderDetailId { get; set; }

        [Required]
        public int OrderId { get; set; }
        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [Required]
        public int FoodId { get; set; }
        [ForeignKey("FoodId")]
        public virtual FoodMenu FoodMenu { get; set; }

        [Required]
        public int Quantity { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } // Pending, Processing, Completed, Cancelled

        public DateTime OrderDate { get; set; }
        public bool IsDeleted { get; set; } = false;

        // 1 OrderDetail có thể có nhiều lần đổi trạng thái (Logs)
        public virtual ICollection<OrderLog> OrderLogs { get; set; }
    }
}