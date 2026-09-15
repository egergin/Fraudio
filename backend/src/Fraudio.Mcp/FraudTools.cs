using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;

namespace Fraudio.Mcp;

[McpServerToolType]
public sealed class FraudTools
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };
    private readonly BackendClient _backend;

    public FraudTools(BackendClient backend)
    {
        _backend = backend;
    }

    [McpServerTool(Name = "get_recent_frauds")]
    [Description("Returns recent suspicious transactions (fraud alerts). "
        + "Each item has transactionId, userId, amount, city, status, triggeredRules, occurredAt.")]
    public async Task<string> GetRecentFrauds(
        [Description("Maximum number of frauds to return (1-100).")] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var body = await _backend.GetRecentFraudsAsync(cancellationToken);
        if (body is null)
        {
            return "[]";
        }

        var items = body.Value.EnumerateArray().Take(limit).Select(e => e.GetRawText());
        return $"[{string.Join(",", items)}]";
    }

    [McpServerTool(Name = "check_user_status")]
    [Description("Returns a transaction user's fraud summary: "
        + "userId, totalTransactions, suspiciousTransactions, lastTransaction.")]
    public async Task<string> CheckUserStatus(
        [Description("External user id, e.g. customer-123.")] string userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return JsonSerializer.Serialize(
                new { code = "VALIDATION_ERROR", message = "userId must not be empty." }, Json);
        }

        var (status, body) = await _backend.GetUserStatusAsync(userId.Trim(), cancellationToken);
        if (status == System.Net.HttpStatusCode.NotFound || body is null)
        {
            return JsonSerializer.Serialize(
                new { code = "USER_NOT_FOUND", message = "Transaction user not found." }, Json);
        }

        return body.Value.GetRawText();
    }
}
