namespace Voytek.Api.Policies;
public sealed record CreatePolicyRequest(Guid AgentId,string Name,string ActionType,decimal? MaximumAmount,decimal? ApprovalThreshold);
public sealed record AuthorizationRequestDto(Guid AgentId,Guid ObjectiveId,Guid BudgetId,string ActionType,decimal Amount,string Currency,string Purpose,string IdempotencyKey,bool ShadowMode);
