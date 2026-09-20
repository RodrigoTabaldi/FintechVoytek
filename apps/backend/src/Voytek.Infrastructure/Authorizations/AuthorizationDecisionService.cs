using Microsoft.EntityFrameworkCore;
using Voytek.Domain.Agents;
using Voytek.Domain.Authorizations;
using Voytek.Domain.Objectives;
using Voytek.Domain.Approvals;
using Voytek.Domain.ShadowMode;
using Voytek.Domain.Ledger;
using Voytek.Domain.Audit;
using Voytek.Infrastructure.Persistence;

namespace Voytek.Infrastructure.Authorizations;

public sealed record AuthorizationEvaluationInput(Guid AgentId, Guid ObjectiveId, Guid BudgetId, string ActionType, decimal Amount, string Currency, string Purpose, string IdempotencyKey, bool ShadowMode);

public sealed class AuthorizationDecisionService(VoytekDbContext dbContext)
{
    public async Task<AuthorizationRequest> EvaluateAsync(AuthorizationEvaluationInput input, CancellationToken cancellationToken)
    {
        var existing = await dbContext.AuthorizationRequests.SingleOrDefaultAsync(x => x.IdempotencyKey == input.IdempotencyKey, cancellationToken);
        if (existing is not null) return existing;
        var now = DateTimeOffset.UtcNow;
        var request = new AuthorizationRequest(Guid.NewGuid(), dbContext.CurrentTenantId, input.AgentId, input.ObjectiveId, input.BudgetId, input.ActionType.Trim(), input.Amount, input.Currency.Trim().ToUpperInvariant(), input.Purpose.Trim(), input.IdempotencyKey.Trim(), now);
        dbContext.AuthorizationRequests.Add(request);
        var agent = await dbContext.Agents.SingleOrDefaultAsync(x => x.Id == input.AgentId, cancellationToken);
        var objective = await dbContext.Objectives.SingleOrDefaultAsync(x => x.Id == input.ObjectiveId, cancellationToken);
        var budget = await dbContext.Budgets.SingleOrDefaultAsync(x => x.Id == input.BudgetId, cancellationToken);
        if (agent is null || agent.Status != AgentStatus.Active || agent.KillSwitchActivatedAtUtc is not null) request.Decide(AuthorizationDecision.Deny, "Agent is not eligible to perform sensitive actions.", now);
        else if (objective is null || objective.AgentId != agent.Id || objective.Status != ObjectiveStatus.Active) request.Decide(AuthorizationDecision.Deny, "Objective is not active for the agent.", now);
        else if (budget is null || budget.AgentId != agent.Id || budget.ObjectiveId != objective.Id || budget.Currency != input.Currency.Trim().ToUpperInvariant()) request.Decide(AuthorizationDecision.Deny, "Budget does not match the requested action.", now);
        else if (input.Amount <= 0 || input.Amount > budget.AvailableAmount) request.Decide(AuthorizationDecision.Deny, "Budget has insufficient available amount.", now);
        else
        {
            var policies = await dbContext.Policies.Where(x => x.AgentId == agent.Id && x.ActionType == input.ActionType.Trim() && x.IsActive).ToListAsync(cancellationToken);
            if (policies.Count == 0) request.Decide(AuthorizationDecision.Deny, "No active policy permits this action.", now);
            else if (policies.Any(x => x.MaximumAmount is not null && input.Amount > x.MaximumAmount)) request.Decide(AuthorizationDecision.Deny, "Amount exceeds the policy maximum.", now);
            else if (agent.AutonomyLevel == AutonomyLevel.Manual) { request.Decide(AuthorizationDecision.HumanApproval, "Manual autonomy requires human approval.", now); dbContext.ApprovalRequests.Add(new ApprovalRequest(Guid.NewGuid(), dbContext.CurrentTenantId, request.Id, now)); }
            else if (policies.Any(x => x.ApprovalThreshold is not null && input.Amount > x.ApprovalThreshold)) { request.Decide(AuthorizationDecision.HumanApproval, "Amount requires human approval.", now); dbContext.ApprovalRequests.Add(new ApprovalRequest(Guid.NewGuid(), dbContext.CurrentTenantId, request.Id, now)); }
            else { if (input.ShadowMode) dbContext.ShadowActions.Add(new ShadowAction(Guid.NewGuid(), dbContext.CurrentTenantId, request.Id, AuthorizationDecision.Allow, now)); else { budget.Reserve(input.Amount, now); dbContext.LedgerEntries.Add(new LedgerEntry(Guid.NewGuid(), dbContext.CurrentTenantId, agent.Id, objective.Id, budget.Id, request.Id, input.Amount, budget.Currency, LedgerEntryType.BudgetReserved, input.IdempotencyKey, now)); } request.Decide(AuthorizationDecision.Allow, input.ShadowMode ? "Action allowed in shadow mode; no budget was reserved." : "Action is within the active policy and budget limits.", now); }
        }
        dbContext.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), dbContext.CurrentTenantId, null, $"authorization.{request.Decision}", "AuthorizationRequest", request.Id, input.IdempotencyKey, now));
        await dbContext.SaveChangesAsync(cancellationToken);
        return request;
    }
}
