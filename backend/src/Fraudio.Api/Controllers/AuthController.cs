using Fraudio.Api.Auth;
using Fraudio.Api.Errors;
using Fraudio.Api.Models;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly FraudioDbContext _db;
    private readonly IJwtTokenService _tokens;
    private readonly ILogger<AuthController> _logger;

    public AuthController(FraudioDbContext db, IJwtTokenService tokens, ILogger<AuthController> logger)
    {
        _db = db;
        _tokens = tokens;
        _logger = logger;
    }
    
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var username = request.Username.Trim();
        var user = await _db.ApplicationUsers
            .FirstOrDefaultAsync(
                u => u.Username.ToLower() == username.ToLower(), cancellationToken);

        if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("AuthenticationFailure {Username}", username);
            return Unauthorized(new ErrorResponse(
                ErrorCodes.InvalidCredentials, "Invalid username or password."));
        }

        var token = _tokens.GenerateToken(user);
        return Ok(new LoginResponse(token, user.Username, user.Role.ToString()));
    }
}
