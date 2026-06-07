using Xunit;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Controller;
using RestaurantManagement.Data;
using RestaurantManagement.Models;

namespace RestaurantManagement.Tests.Controllers
{
    public class FoodMenuControllerTests
    {
        private RestaurantManagementContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<RestaurantManagementContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new RestaurantManagementContext(options);
        }

        // Test 1: Returns only non-deleted items
        [Fact]
        public async Task GetAll_ReturnsOnlyNonDeletedItems()
        {
            // Arrange
            var context = CreateContext();
            context.FoodMenus.AddRange(
                new FoodMenu { FoodId = 1, Name = "Tomato Jelly", Description = "Taste likes tomato", Price = 44000, ImageUrl = "tomato.jpg", IsDeleted = false },
                new FoodMenu { FoodId = 2, Name = "Ramen", Description = "Greasy", Price = 88000, ImageUrl = "ramen.jpg", IsDeleted = false },
                new FoodMenu { FoodId = 3, Name = "Blue Cheese", Description = "Taste cheesy", Price = 300000, ImageUrl = "bluecheese.jpg", IsDeleted = true }
            );
            await context.SaveChangesAsync();
            var controller = new FoodMenuController(context);

            // Act
            var result = await controller.GetAll();

            // Assert
            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            var items = ok.Value as IEnumerable<object>;
            items.Should().HaveCount(2);
        }

        // Test 2: GetById returns 200 when item exists
        [Fact]
        public async Task GetById_WhenExists_ReturnsOk()
        {
            // Arrange
            var context = CreateContext();
            context.FoodMenus.Add(
                new FoodMenu { FoodId = 1, Name = "Tomato Jelly", Description = "Taste likes tomato", Price = 44000, ImageUrl = "tomato.jpg", IsDeleted = false }
            );
            await context.SaveChangesAsync();
            var controller = new FoodMenuController(context);

            // Act
            var result = await controller.GetById(1);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        // Test 3: GetById returns 404 when item does not exist
        [Fact]
        public async Task GetById_WhenNotFound_ReturnsNotFound()
        {
            // Arrange
            var context = CreateContext();
            var controller = new FoodMenuController(context);

            // Act
            var result = await controller.GetById(999);

            // Assert
            result.Should().BeOfType<NotFoundObjectResult>();
        }

        // Test 4: GetById returns 404 for soft-deleted item
        [Fact]
        public async Task GetById_WhenDeleted_ReturnsNotFound()
        {
            // Arrange
            var context = CreateContext();
            context.FoodMenus.Add(
                new FoodMenu { FoodId = 1, Name = "Burger", Description = "Tasty", Price = 5.99m, ImageUrl = "/img/burger.jpg", IsDeleted = true }
            );
            await context.SaveChangesAsync();
            var controller = new FoodMenuController(context);

            // Act
            var result = await controller.GetById(1);

            // Assert
            result.Should().BeOfType<NotFoundObjectResult>();
        }
    }
}