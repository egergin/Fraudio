using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Fraudio.Infrastructure.Persistence;

public sealed class FraudioDbContextFactory : IDesignTimeDbContextFactory<FraudioDbContext>
{
    public FraudioDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<FraudioDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("CONNECTIONSTRINGS__POSTGRES");
        options.UseNpgsql(connectionString);
        return new FraudioDbContext(options.Options);
    }
}
