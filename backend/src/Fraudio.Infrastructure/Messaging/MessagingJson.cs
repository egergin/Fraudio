using System.Text.Json;

namespace Fraudio.Infrastructure.Messaging;

public static class MessagingJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };
}
