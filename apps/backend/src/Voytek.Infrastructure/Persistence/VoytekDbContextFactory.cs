using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Voytek.SharedKernel.Tenancy;

namespace Voytek.Infrastructure.Persistence;

/// <summary>
/// Permite criar migrations sem armazenar credenciais no repositório.
/// </summary>
public sealed class VoytekDbContextFactory : IDesignTimeDbContextFactory<VoytekDbContext>
{
    public VoytekDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__VoytekDatabase")
            ?? throw new InvalidOperationException(
                "Set ConnectionStrings__VoytekDatabase before running Entity Framework commands.");

        var options = new DbContextOptionsBuilder<VoytekDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new VoytekDbContext(options, new TenantContext());
    }
}
