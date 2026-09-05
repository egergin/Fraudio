using System.Text;
using Fraudio.Domain;
using Fraudio.Infrastructure.Persistence;
using Fraudio.Infrastructure.Geolocation;
using Fraudio.Infrastructure.Messaging;
using Fraudio.Infrastructure.Redis;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Fraudio.Application;
using RabbitMQ.Client;
using StackExchange.Redis;
using Fraudio.Api.Realtime;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((context, services, log) => log.ReadFrom.Configuration(context.Configuration).ReadFrom.Services(services));
if (!builder.Environment.IsEnvironment("Testing"))
{
    var connection = builder.Configuration["POSTGRES_CONNECTION"] ?? throw new InvalidOperationException("POSTGRES_CONNECTION must be configured.");
    builder.Services.AddDbContext<FraudioDbContext>(o => o.UseNpgsql(connection));
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(builder.Configuration["REDIS_CONNECTION"] ?? throw new InvalidOperationException("REDIS_CONNECTION must be configured.")));
    builder.Services.AddSingleton<IConnection>(_ => new ConnectionFactory { HostName = builder.Configuration["RABBITMQ_HOST"] ?? "rabbitmq", UserName = builder.Configuration["RABBITMQ_USER"] ?? "guest", Password = builder.Configuration["RABBITMQ_PASSWORD"] ?? "guest" }.CreateConnectionAsync().GetAwaiter().GetResult());
    builder.Services.AddHostedService<RabbitMqTopologyService>();
    builder.Services.AddHostedService<TransactionWorker>();
    builder.Services.AddHostedService<DemoDataSeeder>();
}
var secret = builder.Configuration["JWT_SECRET"] ?? throw new InvalidOperationException("JWT_SECRET must be configured.");
var issuer = builder.Configuration["JWT_ISSUER"] ?? "Fraudio";
var audience = builder.Configuration["JWT_AUDIENCE"] ?? "FraudioDashboard";
builder.Services.AddScoped<IFraudStateStore, RedisFraudStateStore>();
builder.Services.AddScoped<ITransactionMessagePublisher, RabbitMqTransactionPublisher>();
builder.Services.AddScoped<FraudDetectionService>();
builder.Services.AddScoped<ITransactionProcessor, TransactionProcessor>();
builder.Services.AddSingleton<WebSocketNotifier>();
builder.Services.AddSingleton<IRealtimeNotifier>(sp => sp.GetRequiredService<WebSocketNotifier>());
builder.Services.AddHttpClient<OpenMeteoGeolocationService>(client => client.BaseAddress = new Uri("https://geocoding-api.open-meteo.com/"));
builder.Services.AddScoped<IGeolocationService>(sp => new CachedGeolocationService(
    sp.GetRequiredService<OpenMeteoGeolocationService>(),
    sp.GetRequiredService<IConnectionMultiplexer>(),
    sp.GetRequiredService<ILogger<CachedGeolocationService>>()));
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, PasswordHasher<ApplicationUser>>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new()
    {
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudience = audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
        ValidateLifetime = true
    };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            if (context.HttpContext.Request.Path == "/ws") context.Token = context.Request.Query["access_token"];
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseSerilogRequestLogging();
app.UseCors();
app.UseWebSockets();
app.UseExceptionHandler(handler => handler.Run(async c =>
{
    c.Response.StatusCode = 500;
    await c.Response.WriteAsJsonAsync(new { code = "INTERNAL_ERROR", message = "Beklenmeyen bir hata oluştu." });
}));
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Map("/ws", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        return;
    }
    await context.RequestServices.GetRequiredService<WebSocketNotifier>().HandleAsync(await context.WebSockets.AcceptWebSocketAsync(), context.RequestAborted);
}).RequireAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<ApplicationUser>>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await DatabaseSeeder.MigrateAndSeedAsync(db, (user, pwd) => hasher.HashPassword(user, pwd), config, logger);
}

app.Run();
