namespace Voytek.SharedKernel.Tenancy;

/// <summary>
/// Tenant resolvido para a operação atual. A ausência de tenant deve resultar em
/// acesso negado a dados com escopo de organização.
/// </summary>
public interface ICurrentTenant
{
    Guid? TenantId { get; }
}
