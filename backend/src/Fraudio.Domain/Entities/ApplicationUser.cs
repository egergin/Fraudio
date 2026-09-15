using Fraudio.Domain.Enums;

namespace Fraudio.Domain.Entities;

public sealed class ApplicationUser
{
    public Guid Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;
    
    public string PasswordHash { get; set; } = string.Empty;

    public ApplicationRole Role { get; set; }
    
    public DateTime CreatedAt { get; set; }
}
