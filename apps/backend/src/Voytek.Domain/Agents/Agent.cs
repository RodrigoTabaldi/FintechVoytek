using Voytek.Domain.Tenancy;

namespace Voytek.Domain.Agents;

public sealed class Agent : ITenantScoped
{
    private Agent()
    {
    }

    public Agent(
        Guid id,
        Guid tenantId,
        string name,
        string? description,
        AutonomyLevel autonomyLevel,
        DateTimeOffset createdAtUtc)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(tenantId, Guid.Empty);
        Id = id;
        TenantId = tenantId;
        SetDetails(name, description, autonomyLevel);
        Status = AgentStatus.Draft;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; set; }

    public string Name { get; private set; } = null!;

    public string? Description { get; private set; }

    public AgentStatus Status { get; private set; }

    public AutonomyLevel AutonomyLevel { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public DateTimeOffset? KillSwitchActivatedAtUtc { get; private set; }

    public void Update(string name, string? description, AutonomyLevel autonomyLevel, DateTimeOffset updatedAtUtc)
    {
        SetDetails(name, description, autonomyLevel);
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Activate(DateTimeOffset updatedAtUtc)
    {
        if (KillSwitchActivatedAtUtc is not null)
        {
            throw new InvalidOperationException("Deactivate the kill switch before activating an agent.");
        }

        Status = AgentStatus.Active;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Suspend(DateTimeOffset updatedAtUtc)
    {
        Status = AgentStatus.Suspended;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Disable(DateTimeOffset updatedAtUtc)
    {
        Status = AgentStatus.Disabled;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void ActivateKillSwitch(DateTimeOffset updatedAtUtc)
    {
        KillSwitchActivatedAtUtc = updatedAtUtc;
        Status = AgentStatus.Suspended;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void DeactivateKillSwitch(DateTimeOffset updatedAtUtc)
    {
        KillSwitchActivatedAtUtc = null;
        UpdatedAtUtc = updatedAtUtc;
    }

    private void SetDetails(string name, string? description, AutonomyLevel autonomyLevel)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (name.Trim().Length > 150)
        {
            throw new ArgumentOutOfRangeException(nameof(name), "Agent name cannot exceed 150 characters.");
        }

        if (description?.Length > 2_000)
        {
            throw new ArgumentOutOfRangeException(nameof(description), "Agent description cannot exceed 2,000 characters.");
        }

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        AutonomyLevel = autonomyLevel;
    }
}
