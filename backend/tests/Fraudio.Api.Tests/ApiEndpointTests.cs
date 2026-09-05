using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Fraudio.Api.Tests;

public sealed class ApiEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ApiEndpointTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        factory.SeedSampleData();
    }

    private async Task<string> LoginAsAsync(string username, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    [Fact]
    public async Task Login_with_valid_admin_credentials_returns_token_and_role()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "AdminPass123!" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("accessToken", out var token));
        Assert.False(string.IsNullOrWhiteSpace(token.GetString()));
        Assert.Equal("Admin", body.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Login_with_invalid_credentials_returns_unauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "wrongpassword" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Submit_transaction_without_auth_returns_unauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/transactions", new
        {
            userId = "test-user-1",
            amount = 100m,
            location = "Istanbul"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Submit_transaction_as_analyst_returns_forbidden()
    {
        var token = await LoginAsAsync("analyst", "AnalystPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/transactions")
        {
            Content = JsonContent.Create(new { userId = "test-user-1", amount = 100m, location = "Istanbul" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Submit_transaction_as_admin_returns_accepted()
    {
        var token = await LoginAsAsync("admin", "AdminPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/transactions")
        {
            Content = JsonContent.Create(new { userId = "test-user-1", amount = 150.50m, location = "Istanbul" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Accepted", body.GetProperty("status").GetString());
        Assert.True(body.TryGetProperty("transactionId", out _));
    }

    [Fact]
    public async Task Submit_transaction_with_invalid_amount_returns_bad_request()
    {
        var token = await LoginAsAsync("admin", "AdminPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/transactions")
        {
            Content = JsonContent.Create(new { userId = "test-user-1", amount = -10m, location = "Istanbul" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_recent_frauds_returns_data_for_analyst()
    {
        var token = await LoginAsAsync("analyst", "AnalystPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/frauds/recent");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.True(body.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task Get_transaction_user_detail_returns_user_summary()
    {
        var token = await LoginAsAsync("analyst", "AnalystPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/transaction-users/test-user-1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("test-user-1", body.GetProperty("userId").GetString());
        Assert.True(body.GetProperty("totalTransactions").GetInt32() >= 1);
    }

    [Fact]
    public async Task Get_system_health_as_analyst_returns_forbidden()
    {
        var token = await LoginAsAsync("analyst", "AnalystPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/system/health");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Get_system_health_as_admin_returns_ok_and_service_statuses()
    {
        var token = await LoginAsAsync("admin", "AdminPass123!");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/system/health");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Healthy", body.GetProperty("postgreSql").GetString());
        Assert.Equal("Healthy", body.GetProperty("redis").GetString());
        Assert.Equal("Healthy", body.GetProperty("rabbitMq").GetString());
    }
}
