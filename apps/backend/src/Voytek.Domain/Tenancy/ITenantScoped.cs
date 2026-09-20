namespace Voytek.Domain.Tenancy;

/// <summary>
/// Marca dados que pertencem a uma única organização.
/// </summary>
public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
