namespace Voytek.Api.Budgets;

public sealed record CreateBudgetRequest(
    Guid AgentId,
    Guid? ObjectiveId,
    string Name,
    decimal TotalAmount,
    string Currency);

public sealed record BudgetResponse(
    Guid Id,
    Guid AgentId,
    Guid? ObjectiveId,
    string Name,
    decimal TotalAmount,
    decimal ReservedAmount,
    decimal SpentAmount,
    decimal AvailableAmount,
    string Currency,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
