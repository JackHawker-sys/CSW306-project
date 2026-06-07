using Xunit;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Controller;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;
using System.Security.Claims;

namespace RestaurantManagement.Tests.Controllers
{
    public class OrderDetailControllerTests
    {
        private RestaurantManagementContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<RestaurantManagementContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new RestaurantManagementContext(options);
        }

        // Create controller with a fake logged-in user
        private OrderDetailController CreateController(RestaurantManagementContext context, string role = "Admin")
        {
            var controller = new OrderDetailController(context);
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

        // Helper: seed one OrderDetail with a given status
        private async Task SeedDetailAsync(RestaurantManagementContext context, string status)
        {
            context.Orders.Add(new Order
            {
                OrderId = 1,
                UserId = 1,
                OrderDate = DateTime.Now,
                TotalAmount = 10m,
                PaymentStatus = "Unpaid",
                IsFinished = false,
                IsDeleted = false
            });
            context.OrderDetails.Add(new OrderDetail
            {
                OrderDetailId = 1,
                OrderId = 1,
                FoodId = 1,
                Quantity = 1,
                UnitPrice = 10m,
                Status = status,
                OrderDate = DateTime.Now,
                IsDeleted = false
            });
            await context.SaveChangesAsync();
        }

        // Test 1: Valid status transition returns Ok and updates status
        [Fact]
        public async Task UpdateStatus_ValidTransition_UpdatesStatusAndReturnsOk()
        {
            // Arrange
            var context = CreateContext();
            await SeedDetailAsync(context, "Pending");
            var controller = CreateController(context);
            var dto = new UpdateStatusDto { Status = "Processing" };

            // Act
            var result = await controller.UpdateStatus(1, dto);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var detail = await context.OrderDetails.FindAsync(1);
            detail!.Status.Should().Be("Processing");
        }

        // Test 2: Invalid transition (going backward) returns 400
        [Fact]
        public async Task UpdateStatus_InvalidTransition_ReturnsBadRequest()
        {
            // Arrange
            var context = CreateContext();
            await SeedDetailAsync(context, "Completed"); // terminal state — can't go anywhere
            var controller = CreateController(context);
            var dto = new UpdateStatusDto { Status = "Pending" };

            // Act
            var result = await controller.UpdateStatus(1, dto);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        // Test 3: UpdateStatus returns 404 when detail doesn't exist
        [Fact]
        public async Task UpdateStatus_WhenNotFound_ReturnsNotFound()
        {
            // Arrange
            var context = CreateContext();
            var controller = CreateController(context);
            var dto = new UpdateStatusDto { Status = "Processing" };

            // Act
            var result = await controller.UpdateStatus(999, dto);

            // Assert
            result.Should().BeOfType<NotFoundObjectResult>();
        }

        // Test 4: Delete returns 400 when item is already Processing
        [Fact]
        public async Task Delete_WhenProcessing_ReturnsBadRequest()
        {
            // Arrange
            var context = CreateContext();
            await SeedDetailAsync(context, "Processing");
            var controller = CreateController(context);

            // Act
            var result = await controller.Delete(1);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }
    }
}