using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Fraudio.Domain;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Fraudio.Api.Controllers;
[ApiController, Route("api/auth")]
public sealed class AuthController(FraudioDbContext db, IPasswordHasher<ApplicationUser> hasher, IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) return BadRequest(new { code = "INVALID_CREDENTIALS", message = "Kullanıcı adı ve şifre gereklidir." });
        var user = await db.ApplicationUsers.SingleOrDefaultAsync(x => x.Username == request.Username, ct);
        if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed) return Unauthorized(new { code = "INVALID_CREDENTIALS", message = "Geçersiz kullanıcı adı veya şifre." });
        var token = new JwtSecurityToken(config["JWT_ISSUER"] ?? "Fraudio", config["JWT_AUDIENCE"] ?? "FraudioDashboard", [new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Name, user.Username), new(ClaimTypes.Role, user.Role.ToString())], expires: DateTime.UtcNow.AddHours(8), signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!)), SecurityAlgorithms.HmacSha256));
        return Ok(new { accessToken = new JwtSecurityTokenHandler().WriteToken(token), expiresAt = token.ValidTo, role = user.Role.ToString() });
    }
}
public sealed record LoginRequest(string Username, string Password);
