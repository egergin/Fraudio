namespace Fraudio.Infrastructure.Messaging;

public static class MessageRetry
{
    public const string RetryHeader = "x-retry-count";
    public const int MaxRetries = 3;

    public static int GetRetryCount(IDictionary<string, object?>? headers)
    {
        if (headers is null || !headers.TryGetValue(RetryHeader, out var value))
        {
            return 0;
        }

        return value switch
        {
            int i => i,
            long l => (int)l,
            byte[] bytes when int.TryParse(System.Text.Encoding.UTF8.GetString(bytes), out var parsed) => parsed,
            _ => 0
        };
    }

    public static bool ShouldRetry(int retryCount) => retryCount < MaxRetries;

    public static Dictionary<string, object?> NextHeaders(IDictionary<string, object?>? headers)
    {
        var next = headers is null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(headers);
        next[RetryHeader] = GetRetryCount(headers) + 1;
        return next;
    }
}
