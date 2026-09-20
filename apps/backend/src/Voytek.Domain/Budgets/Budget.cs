using Voytek.Domain.Tenancy;

namespace Voytek.Domain.Budgets;

/// <summary>
/// Orçamento lógico. Não representa saldo ou custódia de dinheiro pela Voytek.
/// </summary>
public sealed class Budget : ITenantScoped
{
    private Budget()
    {
    }

    public Budget(
        Guid id,
        Guid tenantId,
        Guid agentId,
        Guid? objectiveId,
        string name,
        decimal totalAmount,
        string currency,
        DateTimeOffset createdAtUtc)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        ArgumentOutOfRangeException.ThrowIfEqual(agentId, Guid.Empty);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (name.Trim().Length > 150)
        {
            throw new ArgumentOutOfRangeException(nameof(name), "Budget name cannot exceed 150 characters.");
        }

        if (totalAmount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(totalAmount), "Budget total must be greater than zero.");
        }

        var normalizedCurrency = currency?.Trim();
        if (normalizedCurrency is null || normalizedCurrency.Length != 3 || !normalizedCurrency.All(char.IsAsciiLetter))
        {
            throw new ArgumentException("Currency must be a three-letter ISO code.", nameof(currency));
        }

        Id = id;
        TenantId = tenantId;
        AgentId = agentId;
        ObjectiveId = objectiveId;
        Name = name.Trim();
        TotalAmount = totalAmount;
        Currency = normalizedCurrency.ToUpperInvariant();
        Status = BudgetStatus.Active;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; set; }

    public Guid AgentId { get; private set; }

    public Guid? ObjectiveId { get; private set; }

    public string Name { get; private set; } = null!;

    public decimal TotalAmount { get; private set; }

    public decimal ReservedAmount { get; private set; }

    public decimal SpentAmount { get; private set; }

    public decimal AvailableAmount => TotalAmount - ReservedAmount - SpentAmount;

    public string Currency { get; private set; } = null!;

    public BudgetStatus Status { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Reserve(decimal amount, DateTimeOffset updatedAtUtc)
    {
        EnsureActive();
        if (amount <= 0 || amount > AvailableAmount)
        {
            throw new InvalidOperationException("Reservation amount must be positive and within the available budget.");
        }

        ReservedAmount += amount;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void ReleaseReservation(decimal amount, DateTimeOffset updatedAtUtc)
    {
        if (amount <= 0 || amount > ReservedAmount)
        {
            throw new InvalidOperationException("Release amount must be positive and within the reserved budget.");
        }

        ReservedAmount -= amount;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void CommitReservedSpend(decimal amount, DateTimeOffset updatedAtUtc)
    {
        if (amount <= 0 || amount > ReservedAmount)
        {
            throw new InvalidOperationException("Spend amount must be positive and within the reserved budget.");
        }

        ReservedAmount -= amount;
        SpentAmount += amount;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Close(DateTimeOffset updatedAtUtc)
    {
        if (ReservedAmount != 0)
        {
            throw new InvalidOperationException("A budget with active reservations cannot be closed.");
        }

        Status = BudgetStatus.Closed;
        UpdatedAtUtc = updatedAtUtc;
    }

    private void EnsureActive()
    {
        if (Status != BudgetStatus.Active)
        {
            throw new InvalidOperationException("Only an active budget can be reserved.");
        }
    }
}
