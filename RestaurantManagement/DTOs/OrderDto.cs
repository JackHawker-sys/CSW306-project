using RestaurantManagement.DTOs.OrderLog;
using System.ComponentModel.DataAnnotations;
namespace RestaurantManagement.DTOs.Order
{
    public class OrderListDto
    {
        public int OrderId { get; set; }
        public int TableId { get; set; }
        public string CustomerName { get; set; }  // UserName or FullName
        public DateTime OrderDate { get; set; }
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; }
        public bool IsFinished { get; set; }
        public int TotalItems { get; set; }  // số món (không tính những đơn đã bị soft delete)
    }

    //chi tiết 1 đơn — dùng ở GET api/orders/{id}
    public class OrderDetailResponseDto // cũng có thể thay = dto của kha nếu cần
    {
        public int OrderId { get; set; }
        public int TableId { get; set; }
        public string CustomerName { get; set; }
        public DateTime OrderDate { get; set; }
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; }
        public bool IsFinished { get; set; }
        public List<OrderDetailItemDto> Items { get; set; } = new();
    }

    //1 món trong đơn — dùng trong OrderDetailResponseDto
    public class OrderDetailItemDto // có thể thay = dto của Kha
    {
        public int OrderDetailId { get; set; }
        public string FoodName { get; set; }
        public string FoodImage { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Subtotal { get; set; }  // UnitPrice × Quantity
        public string Status { get; set; }  // Pending | Processing | Completed | Cancelled
        public DateTime OrderDate { get; set; }
    }

    //PUT api/orders/{id}/status — cập nhật thanh toán
    public class UpdateOrderStatusDto
    {
        public string PaymentStatus { get; set; }
        // Unpaid |  ReadyForCheckout | Suspended
    }
    public class CreateOrderDto
    {
        [Required]
        public int TableId { get; set; }
    }
}