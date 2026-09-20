using Voytek.Domain.Tenancy;
namespace Voytek.Domain.Authorizations;
public sealed class AuthorizationRequest : ITenantScoped
{
    private AuthorizationRequest() { }
    public AuthorizationRequest(Guid id, Guid tenantId, Guid agentId, Guid objectiveId, Guid budgetId, string actionType, decimal amount, string currency, string purpose, string idempotencyKey, DateTimeOffset now)
    { Id=id; TenantId=tenantId; AgentId=agentId; ObjectiveId=objectiveId; BudgetId=budgetId; ActionType=actionType; Amount=amount; Currency=currency; Purpose=purpose; IdempotencyKey=idempotencyKey; CreatedAtUtc=now; }
    public Guid Id {get;private set;} public Guid TenantId {get;set;} public Guid AgentId {get;private set;} public Guid ObjectiveId {get;private set;} public Guid BudgetId {get;private set;}
    public string ActionType {get;private set;}=null!; public decimal Amount {get;private set;} public string Currency {get;private set;}=null!; public string Purpose {get;private set;}=null!; public string IdempotencyKey {get;private set;}=null!;
    public AuthorizationDecision Decision {get;private set;} public string DecisionReason {get;private set;}=null!; public DateTimeOffset CreatedAtUtc {get;private set;} public DateTimeOffset? DecidedAtUtc {get;private set;}
    public void Decide(AuthorizationDecision decision,string reason,DateTimeOffset now){Decision=decision;DecisionReason=reason;DecidedAtUtc=now;}
}
