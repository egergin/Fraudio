using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Fraudio.Tests;

public sealed class ApiTests : IClassFixture<FraudApiFactory>, IAsyncLifetime
{
    private readonly FraudApiFactory _factory;
    private readonly HttpClient _client;

    public ApiTests(FraudApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync() => await _factory.SeedAuthUsersAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<string> LoginAsync(string username, string password)
    {
        var res = await _client.PostAsJsonAsync(
            "/api/auth/login", new { username, password });
        res.EnsureSuccessStatusCode();
        var doc = await res.Content.ReadFromJsonAsync<JsonDocument>();
        return doc!.RootElement.GetProperty("token").GetString()!;
    }

    private void UseToken(string token) =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    private async Task SeedTransactionsAsync(string externalUserId, int approved, int suspicious)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
        var user = new TransactionUser
        {
            Id = Guid.NewGuid(),
            ExternalUserId = externalUserId,
            CreatedAt = DateTime.UtcNow
        };
        db.TransactionUsers.Add(user);
        var now = DateTime.UtcNow;
        for (var i = 0; i < approved + suspicious; i++)
        {
            var isSuspicious = i >= approved;
            var id = Guid.NewGuid();
            db.Transactions.Add(new Transaction
            {
                Id = id,
                TransactionUser = user,
                Amount = 100m + i,
                City = "Istanbul",
                OccurredAt = now.AddMinutes(-(approved + suspicious - i)),
                Status = isSuspicious ? TransactionStatus.Suspicious : TransactionStatus.Approved,
                CreatedAt = now
            });
            if (isSuspicious)
            {
                db.FraudResults.Add(new FraudResult
                {
                    Id = Guid.NewGuid(),
                    TransactionId = id,
                    VelocityTriggered = true,
                    AmountTriggered = true,
                    LocationTriggered = false,
                    DetectedAt = now
                });
            }
        }

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Login_ValidAdmin_ReturnsToken()
    {
        var res = await _client.PostAsJsonAsync(
            "/api/auth/login", new { username = "admin", password = "AdminTest123!" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("Admin", body!.RootElement.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Login_WrongPassword_401()
    {
        var res = await _client.PostAsJsonAsync(
            "/api/auth/login", new { username = "admin", password = "nope" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("INVALID_CREDENTIALS", body!.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Submit_Anonymous_401()
    {
        var res = await _client.PostAsJsonAsync(
            "/api/transactions", new { userId = "u", amount = 10m, location = "Istanbul" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task DashboardSummary_Anonymous_401()
    {
        var res = await _client.GetAsync("/api/dashboard/summary");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task DashboardSummary_ReflectsRealDbTotals()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        async Task<JsonDocument> GetSummaryAsync()
        {
            var res = await _client.GetAsync("/api/dashboard/summary");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            return (await res.Content.ReadFromJsonAsync<JsonDocument>())!;
        }

        var before = await GetSummaryAsync();
        await SeedTransactionsAsync("api-summary-user", approved: 2, suspicious: 1);
        var after = await GetSummaryAsync();

        static decimal Get(JsonDocument d, string name) =>
            d.RootElement.GetProperty(name).GetDecimal();
        static int GetInt(JsonDocument d, string name) =>
            d.RootElement.GetProperty(name).GetInt32();

        Assert.Equal(3, GetInt(after, "totalTransactions") - GetInt(before, "totalTransactions"));
        Assert.Equal(1, GetInt(after, "suspiciousTransactions") - GetInt(before, "suspiciousTransactions"));
        Assert.Equal(1, GetInt(after, "totalUsers") - GetInt(before, "totalUsers"));
        Assert.Equal(1, GetInt(after, "suspiciousUsers") - GetInt(before, "suspiciousUsers"));
        Assert.Equal(303m, Get(after, "totalVolume") - Get(before, "totalVolume"));
        Assert.Equal(102m, Get(after, "suspiciousVolume") - Get(before, "suspiciousVolume"));
    }

    [Fact]
    public async Task DashboardSummary_FromTo_ScopesAggregates()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        async Task<JsonDocument> GetSummaryAsync(string query)
        {
            var res = await _client.GetAsync($"/api/dashboard/summary{query}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            return (await res.Content.ReadFromJsonAsync<JsonDocument>())!;
        }

        static int GetInt(JsonDocument d, string name) =>
            d.RootElement.GetProperty(name).GetInt32();

        var all = await GetSummaryAsync("");
        var future = DateTime.UtcNow.AddHours(1).ToString("O");
        var empty = await GetSummaryAsync($"?from={Uri.EscapeDataString(future)}");
        Assert.Equal(0, GetInt(empty, "totalTransactions"));
        Assert.Equal(0, GetInt(empty, "suspiciousTransactions"));
        Assert.Equal(0, GetInt(empty, "totalUsers"));
        var past = await GetSummaryAsync(
            $"?from=2000-01-01T00:00:00Z&to={Uri.EscapeDataString(DateTime.UtcNow.AddMinutes(5).ToString("O"))}");
        Assert.Equal(GetInt(all, "totalTransactions"), GetInt(past, "totalTransactions"));
        Assert.Equal(GetInt(all, "suspiciousTransactions"), GetInt(past, "suspiciousTransactions"));
    }

    [Fact]
    public async Task DashboardSeries_BucketsByUtcHour_WithBoundariesAndEmpties()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        
        var baseHour = new DateTime(2026, 1, 5, 10, 0, 0, DateTimeKind.Utc);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
            var user = new TransactionUser
            {
                Id = Guid.NewGuid(),
                ExternalUserId = "api-series-user",
                CreatedAt = baseHour
            };
            db.TransactionUsers.Add(user);
            db.Transactions.AddRange(
                new Transaction
                {
                    Id = Guid.NewGuid(), TransactionUser = user, Amount = 100m,
                    City = "Istanbul", OccurredAt = baseHour.AddMinutes(5),
                    Status = TransactionStatus.Approved, CreatedAt = baseHour
                },
                new Transaction
                {
                    Id = Guid.NewGuid(), TransactionUser = user, Amount = 200m,
                    City = "Istanbul", OccurredAt = baseHour.AddMinutes(50),
                    Status = TransactionStatus.Suspicious, CreatedAt = baseHour
                },
                new Transaction
                {
                    Id = Guid.NewGuid(), TransactionUser = user, Amount = 999m,
                    City = "Istanbul", OccurredAt = baseHour.AddHours(3),
                    Status = TransactionStatus.Approved, CreatedAt = baseHour
                });
            await db.SaveChangesAsync();
        }

        var res = await _client.GetAsync(
            "/api/dashboard/series?from=2026-01-05T10:00:00Z&to=2026-01-05T13:00:00Z&granularity=hour");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        var points = body!.RootElement.EnumerateArray().ToList();
        
        Assert.Equal(3, points.Count);
        Assert.Equal(2, points[0].GetProperty("total").GetInt32());
        Assert.Equal(1, points[0].GetProperty("suspicious").GetInt32());
        Assert.Equal(300m, points[0].GetProperty("volume").GetDecimal());
        Assert.Equal(0, points[1].GetProperty("total").GetInt32());
        Assert.Equal(0, points[2].GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task DashboardSeries_InvalidGranularity_400()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        var res = await _client.GetAsync("/api/dashboard/series?granularity=minute");

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task DashboardSeries_TimeZone_ShiftsBuckets()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        
        var instant = new DateTime(2026, 1, 5, 22, 30, 0, DateTimeKind.Utc);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
            var user = new TransactionUser
            {
                Id = Guid.NewGuid(),
                ExternalUserId = "api-series-tz-user",
                CreatedAt = instant
            };
            db.TransactionUsers.Add(user);
            db.Transactions.Add(new Transaction
            {
                Id = Guid.NewGuid(), TransactionUser = user, Amount = 50m,
                City = "Istanbul", OccurredAt = instant,
                Status = TransactionStatus.Approved, CreatedAt = instant
            });
            await db.SaveChangesAsync();
        }

        async Task<List<JsonElement>> GetPointsAsync(string tz)
        {
            var res = await _client.GetAsync(
                "/api/dashboard/series?from=2026-01-05T00:00:00Z&to=2026-01-07T00:00:00Z" +
                $"&granularity=day&timeZone={Uri.EscapeDataString(tz)}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
            return body!.RootElement.EnumerateArray()
                .Where(p => p.GetProperty("total").GetInt32() > 0).ToList();
        }

        var utcHits = await GetPointsAsync("UTC");
        var trHits = await GetPointsAsync("Europe/Istanbul");

        var utcDay = DateTime.Parse(
            utcHits[0].GetProperty("start").GetString()!).Day;
        var trDay = TimeZoneInfo.ConvertTime(
            DateTime.Parse(trHits[0].GetProperty("start").GetString()!),
            TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul")).Day;
        Assert.Equal(5, utcDay);
        Assert.Equal(6, trDay);
    }

    [Fact]
    public async Task DashboardSeries_UnknownTimeZone_400()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        var res = await _client.GetAsync("/api/dashboard/series?timeZone=Atlantis/Nowhere");

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Submit_AsAnalyst_403()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        var res = await _client.PostAsJsonAsync(
            "/api/transactions", new { userId = "u", amount = 10m, location = "Istanbul" });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Submit_AsAdmin_202_PublishesAndNotifies()
    {
        UseToken(await LoginAsync("admin", "AdminTest123!"));
        var before = _factory.Publisher.Published.Count;

        var res = await _client.PostAsJsonAsync(
            "/api/transactions",
            new { userId = "api-user-1", amount = 42.5m, location = "Istanbul" });

        Assert.Equal(HttpStatusCode.Accepted, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("Accepted", body!.RootElement.GetProperty("status").GetString());
        var published = _factory.Publisher.Published[^1];
        Assert.Equal("api-user-1", published.UserId);
        Assert.Equal(42.5m, published.Amount);
        Assert.True(_factory.Notifier.ReceivedCalls > 0);
    }

    [Fact]
    public async Task Submit_ZeroAmount_400()
    {
        UseToken(await LoginAsync("admin", "AdminTest123!"));
        var res = await _client.PostAsJsonAsync(
            "/api/transactions", new { userId = "u", amount = 0m, location = "Istanbul" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task UserDetail_Unknown_404()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        var res = await _client.GetAsync("/api/transaction-users/no-such-user");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task UserDetail_Known_ReturnsTotals()
    {
        await SeedTransactionsAsync("api-detail-user", approved: 3, suspicious: 2);
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        var res = await _client.GetAsync("/api/transaction-users/api-detail-user");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(5, body!.RootElement.GetProperty("totalTransactions").GetInt32());
        Assert.Equal(2, body.RootElement.GetProperty("suspiciousTransactions").GetInt32());
    }

    [Fact]
    public async Task History_ReturnsDesc()
    {
        await SeedTransactionsAsync("api-history-user", approved: 2, suspicious: 1);
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        var res = await _client.GetAsync("/api/transaction-users/api-history-user/transactions");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(3, body!.RootElement.GetArrayLength());
        Assert.Equal("Suspicious", body.RootElement[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task RecentFrauds_ReturnsOnlySuspicious()
    {
        await SeedTransactionsAsync("api-fraud-user", approved: 1, suspicious: 1);
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        var res = await _client.GetAsync("/api/frauds/recent");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.All(body!.RootElement.EnumerateArray(),
            e => Assert.Equal("Suspicious", e.GetProperty("status").GetString()));
    }

    [Fact]
    public async Task RecentTransactions_Anonymous_401()
    {
        var res = await _client.GetAsync("/api/transactions/recent");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task RecentTransactions_ReturnsMixedStatusesDescCappedAt20()
    {
        for (var u = 0; u < 5; u++)
        {
            await SeedTransactionsAsync($"api-recent-user-{u}", approved: 4, suspicious: 1);
        }
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        var res = await _client.GetAsync("/api/transactions/recent");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        var items = body!.RootElement.EnumerateArray().ToList();
        Assert.Equal(20, items.Count);
        Assert.Contains(items, e => e.GetProperty("status").GetString() == "Approved");
        Assert.Contains(items, e => e.GetProperty("status").GetString() == "Suspicious");
        var times = items.Select(e => e.GetProperty("occurredAt").GetDateTime()).ToList();
        Assert.Equal(times.OrderByDescending(t => t).ToList(), times);
    }

    [Fact]
    public async Task RecentTransactions_LimitParam_ControlsRowCount()
    {
        for (var u = 0; u < 5; u++)
        {
            await SeedTransactionsAsync($"api-limit-user-{u}", approved: 4, suspicious: 1);
        }
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));

        async Task<List<JsonElement>> GetAsync(string query)
        {
            var res = await _client.GetAsync($"/api/transactions/recent{query}");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
            return body!.RootElement.EnumerateArray().ToList();
        }
        
        var all = await GetAsync("?limit=100");
        Assert.True(all.Count >= 25);

        Assert.Equal(5, (await GetAsync("?limit=5")).Count);
        Assert.Equal(20, (await GetAsync("")).Count);
        Assert.Equal(Math.Min(50, all.Count), (await GetAsync("?limit=50")).Count);
        Assert.Equal(all.Count, (await GetAsync("?limit=100")).Count);
        
        var five = await GetAsync("?limit=5");
        var times = five.Select(e => e.GetProperty("occurredAt").GetDateTime()).ToList();
        Assert.Equal(times.OrderByDescending(t => t).ToList(), times);
    }

    [Fact]
    public async Task AdminUsers_AsAdmin_OkWithoutHashes()
    {
        UseToken(await LoginAsync("admin", "AdminTest123!"));
        var res = await _client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var raw = await res.Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PasswordHash", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AdminUsers_AsAnalyst_403()
    {
        UseToken(await LoginAsync("analyst", "AnalystTest123!"));
        var res = await _client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Health_ReturnsDependencyMap()
    {
        UseToken(await LoginAsync("admin", "AdminTest123!"));
        var res = await _client.GetAsync("/api/system/health");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonDocument>();
        var deps = body!.RootElement.GetProperty("dependencies");
        Assert.True(deps.TryGetProperty("postgres", out _));
        Assert.True(deps.TryGetProperty("redis", out _));
        Assert.True(deps.TryGetProperty("rabbitmq", out _));
    }
}
