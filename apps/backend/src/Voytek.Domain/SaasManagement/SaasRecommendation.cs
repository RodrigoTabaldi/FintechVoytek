using Voytek.Domain.Tenancy;

namespace Voytek.Domain.SaasManagement;

public sealed class SaasRecommendation : ITenantScoped
{
    private SaasRecommendation() { }
    public SaasRecommendation(Guid id, Guid tenantId, Guid subscriptionId, SaasRecommendationType type, string reason, DateTimeOffset now) { Id=id; TenantId=tenantId; SubscriptionId=subscriptionId; Type=type; Reason=reason; CreatedAtUtc=now; }
    public Guid Id { get; private set; } public Guid TenantId { get; set; } public Guid SubscriptionId { get; private set; } public SaasRecommendationType Type { get; private set; } public string Reason { get; private set; } = null!; public DateTimeOffset CreatedAtUtc { get; private set; }
}
