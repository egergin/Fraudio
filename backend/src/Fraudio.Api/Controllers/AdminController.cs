using Fraudio.Api.Models;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public sealed class AdminController : ControllerBase
{
    private readonly FraudioDbContext _db;

    public AdminController(FraudioDbContext db)
    {
        _db = db;
    }
    
    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<ApplicationUserItemResponse>>> GetUsers(
        CancellationToken cancellationToken)
    {
        var users = await _db.ApplicationUsers
            .OrderBy(u => u.Username)
            .ToListAsync(cancellationToken);

        return Ok(users
            .Select(u => new ApplicationUserItemResponse(
                u.Id, u.Username, u.Email, u.Role.ToString(), u.CreatedAt))
            .ToList());
    }
}
