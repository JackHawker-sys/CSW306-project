using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Models;

namespace RestaurantManagement.Data
{
    public class RestaurantManagementContext : DbContext
    {
        public RestaurantManagementContext(DbContextOptions<RestaurantManagementContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<FoodMenu> FoodMenus { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderDetail> OrderDetails { get; set; }
        public DbSet<OrderLog> OrderLogs { get; set; }

        // Mối quan hệ giữa các table
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. User - Order (1-N)
            modelBuilder.Entity<Order>()
                .HasOne(o => o.User)
                .WithMany(u => u.Orders)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Restrict); // Không cho phép xóa Khách hàng/Nhân viên nếu họ đã từng tạo hóa đơn.

            // 2. Order - OrderDetail (1-N)
            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.Order)
                .WithMany(o => o.OrderDetails)
                .HasForeignKey(od => od.OrderId)
                .OnDelete(DeleteBehavior.Cascade); // Hủy/xóa hóa đơn thì tự động xóa hết các món ăn khách đã gọi trong bàn đó.

            // 3. FoodMenu - OrderDetail (1-N)
            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.FoodMenu)
                .WithMany(fm => fm.OrderDetails)
                .HasForeignKey(od => od.FoodId)
                .OnDelete(DeleteBehavior.Restrict); // Đang có khách đặt món này thì không được phép xóa món khỏi Menu.

            // 4. OrderDetail - OrderLog (1-N)
            modelBuilder.Entity<OrderLog>()
                .HasOne(ol => ol.OrderDetail)
                .WithMany(od => od.OrderLogs)
                .HasForeignKey(ol => ol.OrderDetailId)
                .OnDelete(DeleteBehavior.Restrict); // Bắt buộc phải xóa log trước khi xóa OrderId/OrderDetailId.
        }
    }
}