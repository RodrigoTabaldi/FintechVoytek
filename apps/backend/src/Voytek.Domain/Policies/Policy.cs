using Voytek.Domain.Tenancy;

namespace Voytek.Domain.Policies;

public sealed class Policy : ITenantScoped
{
    private Policy() { }
    public Policy(Guid id, Guid tenantId, Guid agentId, string name, string actionType, decimal? maximumAmount, decimal? approvalThreshold, DateTimeOffset now)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty); ArgumentOutOfRangeException.ThrowIfEqual(agentId, Guid.Empty);
        ArgumentException.ThrowIfNullOrWhiteSpace(name); ArgumentException.ThrowIfNullOrWhiteSpace(actionType);
        if (maximumAmount is <= 0 || approvalThreshold is <= 0 || (maximumAmount is not null && approvalThreshold is not null && approvalThreshold > maximumAmount)) throw new ArgumentOutOfRangeException(nameof(maximumAmount));
        Id=id; TenantId=tenantId; AgentId=agentId; Name=name.Trim(); ActionType=actionType.Trim(); MaximumAmount=maximumAmount; ApprovalThreshold=approvalThreshold; IsActive=true; CreatedAtUtc=UpdatedAtUtc=now;
    }
    public Guid Id { get; private set; } public Guid TenantId { get; set; } public Guid AgentId { get; private set; }
    public string Name { get; private set; }=null!; public string ActionType { get; private set; }=null!;
    public decimal? MaximumAmount { get; private set; } public decimal? ApprovalThreshold { get; private set; } public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; } public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Deactivate(DateTimeOffset now) { IsActive=false; UpdatedAtUtc=now; }
}
