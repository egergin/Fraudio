namespace Fraudio.Api.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "Fraudio";
    public string Audience { get; set; } = "Fraudio";
    public int ExpiryMinutes { get; set; } = 60;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Secret) || Secret.Length < 32)
        {
            throw new InvalidOperationException(
                "JWT secret must be at least 32 characters. Set JWT__SECRET env var.");
        }

        if (ExpiryMinutes <= 0)
        {
            throw new InvalidOperationException("JWT expiry must be positive.");
        }
    }
}
