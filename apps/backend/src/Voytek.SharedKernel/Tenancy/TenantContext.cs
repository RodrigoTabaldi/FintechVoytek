namespace Voytek.SharedKernel.Tenancy;

/// <summary>
/// Contexto scoped preenchido pela camada de transporte após autenticação e autorização.
/// </summary>
public sealed class TenantContext : ICurrentTenant
{
    public Guid? TenantId { get; private set; }

    public void SetTenant(Guid tenantId)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        TenantId = tenantId;
    }
}
