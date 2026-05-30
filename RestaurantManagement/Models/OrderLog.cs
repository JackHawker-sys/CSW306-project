using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantManagement.Models
{
    public class OrderLog
    {
        [Key]
        public int LogId { get; set; }

        [Required]
        public int OrderDetailId { get; set; }
        [ForeignKey("OrderDetailId")]
        public virtual OrderDetail OrderDetail { get; set; }

        [MaxLength(50)]
        public string Status { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }
}