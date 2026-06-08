using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.DTOs
{
    public class CreateTableDto
    {
        [Required]
        public int TableId { get; set; } 
    }
    public class UpdateTableStatusDto
    {
        public bool IsReady { get; set; }
    }
}
