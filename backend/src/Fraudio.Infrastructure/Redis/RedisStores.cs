using System.Text.Json;
using Fraudio.Application.Geolocation;
using Fraudio.Application.State;
using Fraudio.Infrastructure.Messaging;
using StackExchange.Redis;

namespace Fraudio.Infrastructure.Redis;

public sealed class RedisVelocityStore : IVelocityStore
{
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private readonly RedisConnectionProvider _provider;

    public RedisVelocityStore(RedisConnectionProvider provider)
    {
        _provider = provider;
    }

    public async Task<long> AddAndCountAsync(
        string userId, Guid transactionId, DateTime occurredAt,
        CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var db = mux.GetDatabase();
        var key = $"velocity:{userId}";
        var score = ToUnixSeconds(occurredAt);
        var cutoff = ToUnixSeconds(occurredAt - Window);
        
        await db.SortedSetAddAsync(key, transactionId.ToString(), score);
        await db.SortedSetRemoveRangeByScoreAsync(key, double.NegativeInfinity, cutoff, Exclude.Stop);
        await db.KeyExpireAsync(key, Window + TimeSpan.FromMinutes(1));
        return await db.SortedSetLengthAsync(key);
    }

    private static double ToUnixSeconds(DateTime value) =>
        new DateTimeOffset(value).ToUnixTimeMilliseconds() / 1000.0;
}

public sealed class RedisAmountStore : IAmountStore
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(24);
    private readonly RedisConnectionProvider _provider;

    public RedisAmountStore(RedisConnectionProvider provider)
    {
        _provider = provider;
    }

    public async Task<decimal?> GetAverageAsync(
        string userId, DateTime now, CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var db = mux.GetDatabase();
        await TrimAsync(db, userId, now);

        var values = await db.HashValuesAsync(ValuesKey(userId));
        if (values.Length == 0)
        {
            return null;
        }

        decimal sum = 0;
        var count = 0;
        foreach (var value in values)
        {
            if (decimal.TryParse(
                    value.ToString(),
                    System.Globalization.NumberStyles.Number,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var amount))
            {
                sum += amount;
                count++;
            }
        }

        return count == 0 ? null : sum / count;
    }

    public async Task RecordAsync(
        string userId, Guid transactionId, decimal amount, DateTime occurredAt,
        CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var db = mux.GetDatabase();
        var zset = IndexKey(userId);
        var hash = ValuesKey(userId);

        await db.SortedSetAddAsync(zset, transactionId.ToString(), ToUnixSeconds(occurredAt));
        await db.HashSetAsync(hash, transactionId.ToString(), amount.ToString(System.Globalization.CultureInfo.InvariantCulture));
        await TrimAsync(db, userId, occurredAt);
        await db.KeyExpireAsync(zset, Window + TimeSpan.FromHours(1));
        await db.KeyExpireAsync(hash, Window + TimeSpan.FromHours(1));
    }

    private static async Task TrimAsync(IDatabase db, string userId, DateTime now)
    {
        var cutoff = ToUnixSeconds(now - Window);
        var expired = await db.SortedSetRangeByScoreAsync(
            IndexKey(userId), double.NegativeInfinity, cutoff, Exclude.Stop);
        if (expired.Length == 0)
        {
            return;
        }

        var fields = Array.ConvertAll(expired, v => (RedisValue)v.ToString());
        await db.HashDeleteAsync(ValuesKey(userId), fields);
        await db.SortedSetRemoveAsync(IndexKey(userId), expired);
    }

    private static string IndexKey(string userId) => $"amounts:{userId}";
    private static string ValuesKey(string userId) => $"amountv:{userId}";

    private static double ToUnixSeconds(DateTime value) =>
        new DateTimeOffset(value).ToUnixTimeMilliseconds() / 1000.0;
}

public sealed class RedisLocationStore : ILocationStore
{
    private static readonly TimeSpan Ttl = TimeSpan.FromDays(30);
    private readonly RedisConnectionProvider _provider;

    public RedisLocationStore(RedisConnectionProvider provider)
    {
        _provider = provider;
    }

    public async Task<LastLocation?> GetAsync(string userId, CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var json = await mux.GetDatabase().StringGetAsync(Key(userId));
        return json.IsNullOrEmpty
            ? null
            : JsonSerializer.Deserialize<LastLocation>(json.ToString(), MessagingJson.Options);
    }

    public async Task SetAsync(string userId, LastLocation location, CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var json = JsonSerializer.Serialize(location, MessagingJson.Options);
        await mux.GetDatabase().StringSetAsync(Key(userId), json, Ttl);
    }

    private static string Key(string userId) => $"lastloc:{userId}";
}

public sealed class RedisGeoCache : IGeoCache
{
    private static readonly TimeSpan Ttl = TimeSpan.FromDays(30);
    private readonly RedisConnectionProvider _provider;

    public RedisGeoCache(RedisConnectionProvider provider)
    {
        _provider = provider;
    }

    public async Task<GeoCoords?> GetAsync(string city, CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var json = await mux.GetDatabase().StringGetAsync(Key(city));
        return json.IsNullOrEmpty
            ? null
            : JsonSerializer.Deserialize<GeoCoords>(json.ToString(), MessagingJson.Options);
    }

    public async Task SetAsync(string city, GeoCoords coords, CancellationToken cancellationToken = default)
    {
        var mux = await _provider.GetAsync();
        var json = JsonSerializer.Serialize(coords, MessagingJson.Options);
        await mux.GetDatabase().StringSetAsync(Key(city), json, Ttl);
    }

    internal static string Key(string city) => $"geo:{city.Trim().ToLowerInvariant()}";
}
