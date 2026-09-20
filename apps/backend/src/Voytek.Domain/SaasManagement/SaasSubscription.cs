using Voytek.Domain.Tenancy;

namespace Voytek.Domain.SaasManagement;

public sealed class SaasSubscription : ITenantScoped
{
    private SaasSubscription() { }

    public SaasSubscription(Guid id, Guid tenantId, Guid? agentId, string provider, string productName, decimal monthlyCost, string currency, int purchasedSeats, int activeUsers, DateOnly? renewalDate, DateTimeOffset now)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        ArgumentException.ThrowIfNullOrWhiteSpace(provider);
        ArgumentException.ThrowIfNullOrWhiteSpace(productName);
        if (monthlyCost < 0 || purchasedSeats < 0 || activeUsers < 0 || activeUsers > purchasedSeats) throw new ArgumentOutOfRangeException(nameof(monthlyCost));
        if (currency?.Trim().Length != 3) throw new ArgumentException("Currency must be a three-letter ISO code.", nameof(currency));
        Id=id; TenantId=tenantId; AgentId=agentId; Provider=provider.Trim(); ProductName=productName.Trim(); MonthlyCost=monthlyCost; Currency=currency.Trim().ToUpperInvariant(); PurchasedSeats=purchasedSeats; ActiveUsers=activeUsers; RenewalDate=renewalDate; Status=SaasSubscriptionStatus.Active; CreatedAtUtc=now;
    }
    public Guid Id { get; private set; } public Guid TenantId { get; set; } public Guid? AgentId { get; private set; }
    public string Provider { get; private set; } = null!; public string ProductName { get; private set; } = null!; public decimal MonthlyCost { get; private set; } public string Currency { get; private set; } = null!;
    public int PurchasedSeats { get; private set; } public int ActiveUsers { get; private set; } public DateOnly? RenewalDate { get; private set; } public SaasSubscriptionStatus Status { get; private set; } public DateTimeOffset CreatedAtUtc { get; private set; }
}
