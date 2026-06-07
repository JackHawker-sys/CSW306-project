using Xunit;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Controllers;
using RestaurantManagement.Data;
using RestaurantManagement.Models;
using System.Security.Claims;

namespace RestaurantManagement.Tests.Controllers
{
    public class OrderControllerTests
    {
        private RestaurantManagementContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<RestaurantManagementContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new RestaurantManagementContext(options);
        }

        // Create controller with a fake logged-in user
        private OrderController CreateController(RestaurantManagementContext context, string role = "Admin")
        {
            var controller = new OrderController(context);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.Role, role),
                        new Claim("UserId", "1")
                    }, "TestAuth"))
                }
            };
            return controller;
        }

        // Test 1: ConfirmOrder sets IsFinished = true when order is Paid
        [Fact]
        public async Task ConfirmOrder_WhenPaid_SetsIsFinishedAndReturnsOk()
        {
            // Arrange
            var context = CreateContext();
            context.Orders.Add(new Order
            {
                OrderId = 1,
                UserId = 1,
                OrderDate = DateTime.Now,
                TotalAmount = 50m,
                PaymentStatus = "Paid",
                IsFinished = false,
                IsDeleted = false
            });
            await context.SaveChangesAsync();
            var controller = CreateController(context);

            // Act
            var result = await controller.ConfirmOrder(1);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var order = await context.Orders.FindAsync(1);
            order!.IsFinished.Should().BeTrue();
        }

        // Test 2: ConfirmOrder returns 400 when order is Unpaid
        [Fact]
        public async Task ConfirmOrder_WhenUnpaid_ReturnsBadRequest()
        {
            // Arrange
            var context = CreateContext();
            context.Orders.Add(new Order
            {
                OrderId = 1,
                UserId = 1,
                OrderDate = DateTime.Now,
                TotalAmount = 50m,
                PaymentStatus = "Unpaid",
                IsFinished = false,
                IsDeleted = false
            });
            await context.SaveChangesAsync();
            var controller = CreateController(context);

            // Act
            var result = await controller.ConfirmOrder(1);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        // Test 3: ConfirmOrder returns 404 when order doesn't exist
        [Fact]
        public async Task ConfirmOrder_WhenNotFound_ReturnsNotFound()
        {
            // Arrange
            var context = CreateContext();
            var controller = CreateController(context);

            // Act
            var result = await controller.ConfirmOrder(999);

            // Assert
            result.Should().BeOfType<NotFoundObjectResult>();
        }

        // Test 4: Delete returns 400 when an item is already Processing
        [Fact]
        public async Task Delete_WhenHasProcessingItem_ReturnsBadRequest()
        {
            // Arrange
            var context = CreateContext();
            context.Orders.Add(new Order
            {
                OrderId = 1,
                UserId = 1,
                OrderDate = DateTime.Now,
                TotalAmount = 10m,
                PaymentStatus = "Unpaid",
                IsFinished = false,
                IsDeleted = false,
                OrderDetails = new List<OrderDetail>
                {
                    new OrderDetail
                    {
                        OrderDetailId = 1, FoodId = 1, Quantity = 1,
                        UnitPrice = 10m, Status = "Processing",
                        OrderDate = DateTime.Now, IsDeleted = false
                    }
                }
            });
            await context.SaveChangesAsync();
            var controller = CreateController(context);

            // Act
            var result = await controller.Delete(1);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }
    }
}