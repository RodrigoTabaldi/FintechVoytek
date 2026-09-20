namespace Voytek.Api.Outcomes;
public sealed record CreateOutcomeRequest(Guid AgentId,Guid ObjectiveId,Guid? AuthorizationId,string Metric,decimal Value,string Unit,string? Description);
