namespace Voytek.Api.Objectives;

public sealed record CreateObjectiveRequest(Guid AgentId, string Name, string? Description, DateOnly StartDate, DateOnly? EndDate);

public sealed record UpdateObjectiveRequest(string Name, string? Description, DateOnly StartDate, DateOnly? EndDate);

public sealed record ObjectiveResponse(
    Guid Id,
    Guid AgentId,
    string Name,
    string? Description,
    string Status,
    DateOnly StartDate,
    DateOnly? EndDate,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
