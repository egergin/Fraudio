using System.Globalization;
using Fraudio.Application;
using Fraudio.Domain;
using StackExchange.Redis;

namespace Fraudio.Infrastructure.Redis;

public sealed class RedisFraudStateStore(IConnectionMultiplexer redis) : IFraudStateStore
{
    private readonly IDatabase _database = redis.GetDatabase();

    public async Task<int> AddAndCountLastMinuteAsync(string userId, DateTime occurredAt, CancellationToken cancellationToken)
    {
        var key = $"fraud:velocity:{userId}"; var score = occurredAt.ToUniversalTime().Ticks;
        await _database.SortedSetRemoveRangeByScoreAsync(key, double.NegativeInfinity, DateTime.UtcNow.AddMinutes(-1).Ticks);
        await _database.SortedSetAddAsync(key, Guid.NewGuid().ToString("N"), score);
        await _database.KeyExpireAsync(key, TimeSpan.FromMinutes(2));
        return (int)await _database.SortedSetLengthAsync(key, DateTime.UtcNow.AddMinutes(-1).Ticks, double.PositiveInfinity);
    }

    public async Task<IReadOnlyCollection<decimal>> GetAmountsLast24HoursAsync(string userId, DateTime occurredAt, CancellationToken cancellationToken)
    {
        var key = $"fraud:amount:{userId}";
        await _database.SortedSetRemoveRangeByScoreAsync(key, double.NegativeInfinity, occurredAt.AddHours(-24).Ticks);
        var entries = await _database.SortedSetRangeByScoreWithScoresAsync(key, occurredAt.AddHours(-24).Ticks, occurredAt.Ticks - 1);
        var amounts = new List<decimal>(entries.Length);
        foreach (var entry in entries)
        {
            var str = entry.Element.ToString();
            if (string.IsNullOrEmpty(str)) continue;
            var colonIndex = str.IndexOf(':');
            var amountStr = colonIndex >= 0 ? str[(colonIndex + 1)..] : str;
            if (decimal.TryParse(amountStr, CultureInfo.InvariantCulture, out var parsed))
            {
                amounts.Add(parsed);
            }
        }
        return amounts;
    }

    public async Task<TransactionSnapshot?> GetLastLocationAsync(string userId, CancellationToken cancellationToken)
    {
        var values = await _database.HashGetAllAsync($"fraud:location:{userId}");
        if (values.Length == 0) return null;
        var map = values.ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());
        return new TransactionSnapshot(0m, double.Parse(map["latitude"], CultureInfo.InvariantCulture), double.Parse(map["longitude"], CultureInfo.InvariantCulture), DateTime.Parse(map["occurredAt"], null, DateTimeStyles.RoundtripKind));
    }

    public async Task RecordProcessedAsync(TransactionReceived transaction, CancellationToken cancellationToken)
    {
        var amountKey = $"fraud:amount:{transaction.UserId}";
        var member = $"{transaction.TransactionId:N}:{transaction.Amount.ToString(CultureInfo.InvariantCulture)}";
        await _database.SortedSetAddAsync(amountKey, member, transaction.OccurredAt.Ticks);
        await _database.KeyExpireAsync(amountKey, TimeSpan.FromHours(25));
        await _database.HashSetAsync($"fraud:location:{transaction.UserId}", [new("latitude", transaction.Latitude), new("longitude", transaction.Longitude), new("occurredAt", transaction.OccurredAt.ToUniversalTime().ToString("O"))]);
    }
}
