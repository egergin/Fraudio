using System.ComponentModel.DataAnnotations;

namespace Fraudio.Api.Models;

public sealed class LoginRequest
{
    [Required, StringLength(64, MinimumLength = 1)]
    public string Username { get; set; } = string.Empty;

    [Required, StringLength(256, MinimumLength = 1)]
    public string Password { get; set; } = string.Empty;
}

public sealed record LoginResponse(string Token, string Username, string Role);
