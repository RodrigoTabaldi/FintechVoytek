using Voytek.Domain.Tenancy;

namespace Voytek.Domain.Objectives;

public sealed class Objective : ITenantScoped
{
    private Objective()
    {
    }

    public Objective(
        Guid id,
        Guid tenantId,
        Guid agentId,
        string name,
        string? description,
        DateOnly startDate,
        DateOnly? endDate,
        DateTimeOffset createdAtUtc)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        ArgumentOutOfRangeException.ThrowIfEqual(agentId, Guid.Empty);
        Id = id;
        TenantId = tenantId;
        AgentId = agentId;
        SetDetails(name, description, startDate, endDate);
        Status = ObjectiveStatus.Draft;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; set; }

    public Guid AgentId { get; private set; }

    public string Name { get; private set; } = null!;

    public string? Description { get; private set; }

    public ObjectiveStatus Status { get; private set; }

    public DateOnly StartDate { get; private set; }

    public DateOnly? EndDate { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string name, string? description, DateOnly startDate, DateOnly? endDate, DateTimeOffset updatedAtUtc)
    {
        SetDetails(name, description, startDate, endDate);
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Activate(DateTimeOffset updatedAtUtc)
    {
        if (Status is ObjectiveStatus.Completed or ObjectiveStatus.Cancelled)
        {
            throw new InvalidOperationException("A completed or cancelled objective cannot be activated.");
        }

        Status = ObjectiveStatus.Active;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Complete(DateTimeOffset updatedAtUtc)
    {
        if (Status != ObjectiveStatus.Active)
        {
            throw new InvalidOperationException("Only an active objective can be completed.");
        }

        Status = ObjectiveStatus.Completed;
        UpdatedAtUtc = updatedAtUtc;
    }

    private void SetDetails(string name, string? description, DateOnly startDate, DateOnly? endDate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (name.Trim().Length > 200)
        {
            throw new ArgumentOutOfRangeException(nameof(name), "Objective name cannot exceed 200 characters.");
        }

        if (description?.Length > 4_000)
        {
            throw new ArgumentOutOfRangeException(nameof(description), "Objective description cannot exceed 4,000 characters.");
        }

        if (endDate is not null && endDate < startDate)
        {
            throw new ArgumentOutOfRangeException(nameof(endDate), "Objective end date cannot be before its start date.");
        }

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        StartDate = startDate;
        EndDate = endDate;
    }
}
