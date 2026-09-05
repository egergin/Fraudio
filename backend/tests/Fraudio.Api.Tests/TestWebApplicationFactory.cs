using Fraudio.Application;
using Fraudio.Domain;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using RabbitMQ.Client;
using StackExchange.Redis;

namespace Fraudio.Api.Tests;

public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    static TestWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable("POSTGRES_CONNECTION", "Host=localhost;Database=test;Username=test;Password=test");
        Environment.SetEnvironmentVariable("REDIS_CONNECTION", "localhost:6379");
        Environment.SetEnvironmentVariable("JWT_SECRET", "super-secret-test-jwt-key-minimum-32-chars-long!");
        Environment.SetEnvironmentVariable("JWT_ISSUER", "Fraudio");
        Environment.SetEnvironmentVariable("JWT_AUDIENCE", "FraudioDashboard");
        Environment.SetEnvironmentVariable("SEED_ADMIN_PASSWORD", "AdminPass123!");
        Environment.SetEnvironmentVariable("SEED_ANALYST_PASSWORD", "AnalystPass123!");
        Environment.SetEnvironmentVariable("RABBITMQ_HOST", "localhost");
    }

    private readonly string _dbName = Guid.NewGuid().ToString("N");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.AddDbContext<FraudioDbContext>(options =>
            {
                options.UseInMemoryDatabase(_dbName);
            });

            var mockDatabase = Substitute.For<IDatabase>();
            mockDatabase.PingAsync(Arg.Any<CommandFlags>()).Returns(Task.FromResult(TimeSpan.FromMilliseconds(5)));

            var mockRedis = Substitute.For<IConnectionMultiplexer>();
            mockRedis.GetDatabase(Arg.Any<int>(), Arg.Any<object>()).Returns(mockDatabase);
            services.AddSingleton(mockRedis);

            var mockRabbit = Substitute.For<IConnection>();
            mockRabbit.IsOpen.Returns(true);
            services.AddSingleton(mockRabbit);

            var mockPub = Substitute.For<ITransactionMessagePublisher>();
            services.AddScoped(_ => mockPub);

            var mockGeo = Substitute.For<IGeolocationService>();
            mockGeo.ResolveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<Geolocation?>(new Geolocation(41.0082, 28.9784, "Istanbul", "Turkey")));
            services.AddScoped(_ => mockGeo);
        });
    }

    public void SeedSampleData()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
        if (!db.TransactionUsers.Any(x => x.ExternalUserId == "test-user-1"))
        {
            var user = new TransactionUser { ExternalUserId = "test-user-1" };
            db.TransactionUsers.Add(user);

            var suspiciousTx = new Transaction
            {
                Id = Guid.NewGuid(),
                TransactionUser = user,
                Amount = 5000m,
                City = "Istanbul",
                Country = "Turkey",
                Latitude = 41.0,
                Longitude = 28.9,
                OccurredAt = DateTime.UtcNow,
                Status = TransactionStatus.Suspicious
            };
            db.Transactions.Add(suspiciousTx);
            db.FraudResults.Add(new FraudResult
            {
                Transaction = suspiciousTx,
                VelocityTriggered = true,
                AmountTriggered = true,
                LocationTriggered = false
            });

            db.SaveChanges();
        }
    }
}
