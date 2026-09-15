using System.Text;
using Fraudio.Api.Auth;
using Fraudio.Api.Errors;
using Fraudio.Api.Realtime;
using Fraudio.Api.Services;
using Fraudio.Application.Fraud;
using Fraudio.Application.Geolocation;
using Fraudio.Application.Messaging;
using Fraudio.Application.Realtime;
using Fraudio.Application.State;
using Fraudio.Infrastructure.Geolocation;
using Fraudio.Infrastructure.Messaging;
using Fraudio.Infrastructure.Persistence;
using Fraudio.Infrastructure.Redis;
using Fraudio.Infrastructure.Simulation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var detail = string.Join("; ", context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .Where(m => !string.IsNullOrWhiteSpace(m))
                .Distinct());
            return new BadRequestObjectResult(new ErrorResponse(
                ErrorCodes.ValidationError,
                string.IsNullOrWhiteSpace(detail) ? "Request validation failed." : detail));
        };
    });

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
builder.Services.Configure<JwtOptions>(jwtSection);
var jwtOptions = jwtSection.Get<JwtOptions>() ?? new JwtOptions();
jwtOptions.Validate();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = key,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Path.StartsWithSegments("/ws"))
                {
                    var token = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(token))
                    {
                        context.Token = token;
                    }
                }

                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsJsonAsync(new ErrorResponse(
                    ErrorCodes.Unauthorized, "Authentication required."));
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsJsonAsync(new ErrorResponse(
                    ErrorCodes.Forbidden, "Insufficient permissions."));
            }
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<FraudioDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));
builder.Services.AddScoped<IFraudioDbContext>(
    sp => sp.GetRequiredService<FraudioDbContext>());

builder.Services.Configure<RabbitMqOptions>(
    builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<ITransactionPublisher, RabbitMqTransactionPublisher>();
builder.Services.AddSingleton<IFraudEventPublisher, RabbitMqFraudEventPublisher>();
builder.Services.AddHostedService<RabbitMqSetupService>();
builder.Services.AddHostedService<TransactionConsumerService>();

var simSection = builder.Configuration.GetSection(TransactionSimulatorOptions.SectionName);
builder.Services.Configure<TransactionSimulatorOptions>(simSection);
var simOptions = simSection.Get<TransactionSimulatorOptions>() ?? new TransactionSimulatorOptions();
simOptions.Validate();
builder.Services.AddHostedService<TransactionSimulatorService>();

builder.Services.AddScoped<IFraudDetectionService, FraudDetectionService>();

builder.Services.Configure<RedisOptions>(
    builder.Configuration.GetSection(RedisOptions.SectionName));
builder.Services.AddSingleton<RedisConnectionProvider>();
builder.Services.AddSingleton<IVelocityStore, RedisVelocityStore>();
builder.Services.AddSingleton<IAmountStore, RedisAmountStore>();
builder.Services.AddSingleton<ILocationStore, RedisLocationStore>();
builder.Services.AddSingleton<IGeoCache, RedisGeoCache>();

builder.Services.Configure<GeolocationOptions>(
    builder.Configuration.GetSection(GeolocationOptions.SectionName));
builder.Services.AddHttpClient<IGeolocationService, OpenMeteoGeolocationService>(
    client => client.Timeout = TimeSpan.FromSeconds(5));

builder.Services.AddSingleton<WebSocketConnectionManager>();
builder.Services.AddSingleton<WebSocketNotifier>();
builder.Services.AddSingleton<IRealtimeNotifier>(
    sp => sp.GetRequiredService<WebSocketNotifier>());
builder.Services.AddScoped<ISystemHealthService, SystemHealthService>();
builder.Services.AddHostedService<SystemStatusBroadcastService>();

var app = builder.Build();

if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
    var migrateLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
        .CreateLogger("Startup");
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            migrateLogger.LogInformation("Database migrated");
            break;
        }
        catch (Exception ex) when (attempt < 5)
        {
            migrateLogger.LogWarning(ex, "Database migrate attempt {Attempt} failed, retrying", attempt);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }

    // Apply SEED_* credentials (create or update the login users, no-op otherwise).
    static string SeedEnv(string name, string fallback) =>
        string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name))
            ? fallback
            : Environment.GetEnvironmentVariable(name)!;
    await SeedData.EnsureSeedUsersAsync(
        db,
        SeedEnv("SEED_ADMIN_USERNAME", "admin"),
        SeedEnv("SEED_ADMIN_PASSWORD", "Admin123!"),
        SeedEnv("SEED_ADMIN_EMAIL", "admin@example.com"),
        SeedEnv("SEED_ANALYST_USERNAME", "analyst"),
        SeedEnv("SEED_ANALYST_PASSWORD", "Analyst123!"),
        SeedEnv("SEED_ANALYST_EMAIL", "analyst@example.com"));
    migrateLogger.LogInformation("Seed users ensured");
}

app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseCors("Frontend");
app.UseWebSockets();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapWebSocketEndpoint();

app.Run();
