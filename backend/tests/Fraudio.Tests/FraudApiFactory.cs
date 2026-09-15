using Fraudio.Application.Fraud;
using Fraudio.Application.Geolocation;
using Fraudio.Application.Messaging;
using Fraudio.Application.Realtime;
using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Fraudio.Tests;

public sealed class FraudApiFactory : WebApplicationFactory<Program>
{
    public FakeTransactionPublisher Publisher { get; } = new();
    public FakeRealtimeNotifier Notifier { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            foreach (var descriptor in services
                         .Where(d => d.ServiceType == typeof(IHostedService)).ToList())
            {
                services.Remove(descriptor);
            }
            
            services.RemoveAll(typeof(DbContextOptions<FraudioDbContext>));
            services.RemoveAll(typeof(IDbContextOptionsConfiguration<FraudioDbContext>));
            services.RemoveAll(typeof(FraudioDbContext));
            services.AddDbContext<FraudioDbContext>(o =>
                o.UseInMemoryDatabase("api-tests"));
            
            services.AddSingleton<ITransactionPublisher>(Publisher);
            services.AddSingleton<IGeolocationService, FakeGeolocationService>();
            services.AddSingleton<IRealtimeNotifier>(Notifier);
        });
    }

    public async Task SeedAuthUsersAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
        if (await db.ApplicationUsers.AnyAsync())
        {
            return;
        }

        db.ApplicationUsers.AddRange(
            new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Username = "admin",
                Email = "admin@fraudio.com",
                PasswordHash = PasswordHasher.Hash("AdminTest123!"),
                Role = ApplicationRole.Admin,
                CreatedAt = DateTime.UtcNow
            },
            new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Username = "analyst",
                Email = "analyst@fraudio.com",
                PasswordHash = PasswordHasher.Hash("AnalystTest123!"),
                Role = ApplicationRole.Analyst,
                CreatedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();
    }

    public sealed class FakeTransactionPublisher : ITransactionPublisher
    {
        public List<TransactionReceivedMessage> Published { get; } = [];

        public Task PublishAsync(TransactionReceivedMessage message, CancellationToken ct = default)
        {
            Published.Add(message);
            return Task.CompletedTask;
        }
    }

    public sealed class FakeRealtimeNotifier : IRealtimeNotifier
    {
        public int ReceivedCalls { get; private set; }

        public Task TransactionReceivedAsync(
            Guid transactionId, string userId, decimal amount, string? city,
            DateTime occurredAt, CancellationToken ct = default)
        {
            ReceivedCalls++;
            return Task.CompletedTask;
        }

        public Task FraudProcessedAsync(
            FraudOutcome outcome, string userId, decimal amount, string? city,
            DateTime occurredAt, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeGeolocationService : IGeolocationService
    {
        public Task<GeoCoords?> ResolveAsync(string city, CancellationToken ct = default) =>
            Task.FromResult<GeoCoords?>(null);
    }
}
