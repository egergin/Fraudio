using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Fraudio.Infrastructure.Redis;

public sealed class RedisOptions
{
    public const string SectionName = "Redis";

    public string Connection { get; set; } = "localhost:6379";
}

public class RedisConnectionProvider : IAsyncDisposable
{
    private readonly RedisOptions _options;
    private readonly ILogger<RedisConnectionProvider> _logger;
    private IConnectionMultiplexer? _multiplexer;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public RedisConnectionProvider(IOptions<RedisOptions> options, ILogger<RedisConnectionProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public virtual async Task<IConnectionMultiplexer> GetAsync()
    {
        if (_multiplexer is { IsConnected: true })
        {
            return _multiplexer;
        }

        await _lock.WaitAsync();
        try
        {
            if (_multiplexer is { IsConnected: true })
            {
                return _multiplexer;
            }

            _multiplexer?.Dispose();
            _multiplexer = await ConnectionMultiplexer.ConnectAsync(_options.Connection);
            _logger.LogInformation("Redis connected {Connection}", _options.Connection);
            return _multiplexer;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_multiplexer is not null)
        {
            await _multiplexer.CloseAsync();
            _multiplexer.Dispose();
        }

        _lock.Dispose();
    }
}
