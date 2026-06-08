using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Data;
using RestaurantManagement.Models;
using RestaurantManagement.DTOs;

namespace RestaurantManagement.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "Admin")]  // toàn bộ controller chỉ Admin
    public class TableController : ControllerBase
    {
        private readonly RestaurantManagementContext _context;

        public TableController(RestaurantManagementContext context)
        {
            _context = context;
        }

       
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var tables = await _context.Tables
                .Where(t => !t.IsDeleted)
                .Select(t => new
                {
                    t.TableId,
                    t.IsReady
                })
                .ToListAsync();

            return Ok(tables);
        }

       
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var table = await _context.Tables
                .FirstOrDefaultAsync(t => t.TableId == id && !t.IsDeleted);

            if (table == null)
                return NotFound(new { message = "Table not found." });

            return Ok(new
            {
                table.TableId,
                table.IsReady
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTableDto dto)
        {
            // Kiểm tra ID đã tồn tại chưa (kể cả đã bị soft delete)
            bool exists = await _context.Tables
                .AnyAsync(t => t.TableId == dto.TableId);

            if (exists)
                return BadRequest(new { message = $"Table #{dto.TableId} already exists." });

            var table = new Table
            {
                TableId = dto.TableId,
                IsReady = true,
                IsDeleted = false
            };

            _context.Tables.Add(table);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = table.TableId }, new
            {
                message = "Table created successfully.",
                tableId = table.TableId,
                isReady = table.IsReady
            });
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateTableStatusDto dto)
        {
            var table = await _context.Tables
                .FirstOrDefaultAsync(t => t.TableId == id && !t.IsDeleted);

            if (table == null)
                return NotFound(new { message = "Table not found." });

            // Không cho đổi IsReady = true nếu bàn đang có order chưa xong
            if (dto.IsReady == true)
            {
                bool hasActiveOrder = await _context.Orders
                    .AnyAsync(o => o.TableId == id && !o.IsFinished && !o.IsDeleted);

                if (hasActiveOrder)
                    return BadRequest(new { message = "Table still has an active order." });
            }

            table.IsReady = dto.IsReady;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Table status updated.",
                tableId = table.TableId,
                isReady = table.IsReady
            });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var table = await _context.Tables
                .FirstOrDefaultAsync(t => t.TableId == id && !t.IsDeleted);

            if (table == null)
                return NotFound(new { message = "Table not found." });

            // Không xóa nếu đang có order active
            bool hasActiveOrder = await _context.Orders
                .AnyAsync(o => o.TableId == id && !o.IsFinished && !o.IsDeleted);

            if (hasActiveOrder)
                return BadRequest(new { message = "Cannot delete table with an active order." });

            table.IsDeleted = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Table #{id} deleted." });
        }
    }
}