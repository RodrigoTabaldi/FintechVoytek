using Voytek.Domain.Agents;

namespace Voytek.Api.Agents;

public sealed record CreateAgentRequest(
    string Name,
    string? Description,
    AutonomyLevel AutonomyLevel,
    string Specialization = "Custom",
    string? ObjectiveName = null,
    string? ObjectiveDescription = null);

public sealed record UpdateAgentRequest(string Name, string? Description, AutonomyLevel AutonomyLevel);

public sealed record GenerateAgentProposalRequest(string Instruction);

public sealed record AgentResponse(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    string AutonomyLevel,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? KillSwitchActivatedAtUtc,
    string Specialization);
