namespace Voytek.Domain.Tenancy;

/// <summary>
/// Associação de uma identidade de usuário a uma organização.
/// UserId é uma referência à futura fronteira de Identity, sem acoplamento de banco.
/// </summary>
public sealed class Membership : ITenantScoped
{
    private Membership()
    {
    }

    public Membership(Guid id, Guid tenantId, Guid userId, MembershipRole role, DateTimeOffset createdAtUtc)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        ArgumentOutOfRangeException.ThrowIfEqual(userId, Guid.Empty);

        Id = id;
        TenantId = tenantId;
        UserId = userId;
        Role = role;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; set; }

    public Guid UserId { get; private set; }

    public MembershipRole Role { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public Tenant Tenant { get; private set; } = null!;
}
