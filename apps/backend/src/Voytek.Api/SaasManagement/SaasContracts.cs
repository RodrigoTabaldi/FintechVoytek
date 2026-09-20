namespace Voytek.Api.SaasManagement;
public sealed record CreateSaasSubscriptionRequest(Guid? AgentId, string Provider, string ProductName, decimal MonthlyCost, string Currency, int PurchasedSeats, int ActiveUsers, DateOnly? RenewalDate);
