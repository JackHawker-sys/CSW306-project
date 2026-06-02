using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.DTOs;
using RestaurantManagement.Models;

namespace RestaurantManagement.Controller
{
    [Route("api/[controller]")]
    [ApiController]
    public class FoodMenuController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png" };

        public FoodMenuController(RestaurantManagementContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var menus = await _context.FoodMenus
                .Where(f => !f.IsDeleted)
                .Select(f => new
                {
                    f.FoodId,
                    f.Name,
                    f.Description,
                    f.Price,
                    f.ImageUrl
                })
                .ToListAsync();

            return Ok(menus);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var food = await _context.FoodMenus
                .Where(f => f.FoodId == id && !f.IsDeleted)
                .Select(f => new
                {
                    f.FoodId,
                    f.Name,
                    f.Description,
                    f.Price,
                    f.ImageUrl
                })
                .FirstOrDefaultAsync();

            if (food == null)
                return NotFound(new { message = $"Food item with ID {id} was not found." });

            return Ok(food);
        }

        [HttpPost]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Create([FromForm] CreateFoodMenuDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            string? imageUrl = null;

            if (dto.Image != null)
            {
                // Success: error = null, chạy bình thường
                // Failure: urlSaved = null, trả về bad request
                var (savedUrl, error) = await SaveImageAsync(dto.Image);
                if (error != null)
                    return BadRequest(new { message = error });

                imageUrl = savedUrl;
            }

            var food = new FoodMenu
            {
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                ImageUrl = imageUrl
            };

            _context.FoodMenus.Add(food);
            await _context.SaveChangesAsync();

            return Ok(food);
        }

        [HttpPut("{id}")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Update(int id, [FromForm] UpdateFoodMenuDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var food = await _context.FoodMenus
                .FirstOrDefaultAsync(f => f.FoodId == id && !f.IsDeleted);

            if (food == null)
                return NotFound(new { message = $"Food item with ID {id} was not found." });

            food.Name = dto.Name ?? food.Name;
            food.Description = dto.Description??food.Description;
            food.Price = dto.Price ?? food.Price;

            // Chỉ thay thế ảnh khi có ảnh được upload
            if (dto.Image != null)
            {
                if (!string.IsNullOrEmpty(food.ImageUrl))
                    DeleteImageFile(food.ImageUrl);

                var (savedUrl, error) = await SaveImageAsync(dto.Image);
                if (error != null)
                    return BadRequest(new { message = error });

                food.ImageUrl = savedUrl;
            }

            await _context.SaveChangesAsync();

            return Ok(food);
        }
        // Xóa món ăn với chức vụ là admin
        [HttpDelete("{id}")]
        [Authorize(Policy = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var food = await _context.FoodMenus
                .FirstOrDefaultAsync(f => f.FoodId == id && !f.IsDeleted);

            if (food == null)
                return NotFound(new { message = $"Food item with ID {id} was not found." });

            food.IsDeleted = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"'{food.Name}' has been removed from the menu." });
        }

        // Các hàm phụ vv
        private async Task<(string? url, string? error)> SaveImageAsync(IFormFile image)
        {
            var extension = Path.GetExtension(image.FileName).ToLowerInvariant();

            if (!AllowedExtensions.Contains(extension))
                return (null, $"Invalid file type '{extension}'. Only JPG and PNG are allowed.");

            // Tạo tên duy nhất, tránh bị trùng
            var fileName = $"{Guid.NewGuid()}{extension}";
            var folderPath = Path.Combine("wwwroot", "assets", "images", "FoodMenu");

            Directory.CreateDirectory(folderPath);

            var filePath = Path.Combine(folderPath, fileName);
            await using var stream = new FileStream(filePath, FileMode.Create);
            await image.CopyToAsync(stream);

            return ($"/assets/images/FoodMenu/{fileName}", null);
        }
        private void DeleteImageFile(string imageUrl)
        {
            var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var deletePath = Path.Combine("wwwroot", relativePath);

            if (System.IO.File.Exists(deletePath))
                System.IO.File.Delete(deletePath);
        }
    }
}