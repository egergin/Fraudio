namespace Fraudio.Mcp;

public sealed class McpOptions
{
    public const string SectionName = "Mcp";

    public string BackendBaseUrl { get; set; } = "http://localhost:8080";
    public string BackendUsername { get; set; } = "analyst";
    public string BackendPassword { get; set; } = string.Empty;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(BackendBaseUrl))
        {
            throw new InvalidOperationException("MCP backend base URL must be set (Mcp:BackendBaseUrl).");
        }

        if (string.IsNullOrWhiteSpace(BackendUsername) || string.IsNullOrWhiteSpace(BackendPassword))
        {
            throw new InvalidOperationException(
                "MCP backend credentials must be set (Mcp:BackendUsername / Mcp:BackendPassword).");
        }
    }
}
