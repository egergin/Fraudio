using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Fraudio.Mcp;

public sealed class BackendClient
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly HttpClient _http;
    private readonly McpOptions _options;
    private readonly ILogger<BackendClient> _logger;
    private string? _token;
    private readonly SemaphoreSlim _authLock = new(1, 1);

    public BackendClient(HttpClient http, IOptions<McpOptions> options, ILogger<BackendClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<JsonElement?> GetRecentFraudsAsync(CancellationToken ct = default) =>
        await GetAsync("/api/frauds/recent", ct);

    public async Task<(HttpStatusCode Status, JsonElement? Body)> GetUserStatusAsync(
        string userId, CancellationToken ct = default) =>
        await GetWithStatusAsync($"/api/transaction-users/{Uri.EscapeDataString(userId)}", ct);

    private async Task<JsonElement?> GetAsync(string path, CancellationToken ct)
    {
        var (_, body) = await GetWithStatusAsync(path, ct);
        return body;
    }

    private async Task<(HttpStatusCode Status, JsonElement? Body)> GetWithStatusAsync(
        string path, CancellationToken ct)
    {
        var response = await SendAsync(path, await GetTokenAsync(ct), ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            response = await SendAsync(path, await RefreshTokenAsync(force: true, ct), ct);
        }

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return (response.StatusCode, null);
        }

        response.EnsureSuccessStatusCode();
        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return (response.StatusCode, doc.RootElement.Clone());
    }

    private async Task<HttpResponseMessage> SendAsync(string path, string token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Base(path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _http.SendAsync(request, ct);
    }

    private string Base(string path) => _options.BackendBaseUrl.TrimEnd('/') + path;

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(_token))
        {
            return _token;
        }

        return await RefreshTokenAsync(ct);
    }

    private async Task<string> RefreshTokenAsync(CancellationToken ct) =>
        await RefreshTokenAsync(force: false, ct);

    private async Task<string> RefreshTokenAsync(bool force, CancellationToken ct)
    {
        await _authLock.WaitAsync(ct);
        try
        {
            if (!force && !string.IsNullOrEmpty(_token))
            {
                return _token;
            }

            using var response = await _http.PostAsJsonAsync(
                Base("/api/auth/login"),
                new { username = _options.BackendUsername, password = _options.BackendPassword }, ct);
            response.EnsureSuccessStatusCode();
            using var stream = await response.Content.ReadAsStreamAsync(ct);
            var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            _token = doc.RootElement.GetProperty("token").GetString()
                ?? throw new InvalidOperationException("Backend login returned no token.");
            _logger.LogInformation("MCP backend login succeeded ({Username})", _options.BackendUsername);
            return _token;
        }
        finally
        {
            _authLock.Release();
        }
    }
}
