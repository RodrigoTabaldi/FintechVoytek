using Microsoft.EntityFrameworkCore;
using Voytek.Domain.Agents;
using Voytek.Domain.Approvals;
using Voytek.Domain.Authorizations;
using Voytek.Domain.Budgets;
using Voytek.Domain.Ledger;
using Voytek.Domain.Objectives;
using Voytek.Domain.ShadowMode;
using Voytek.Domain.Audit;
using Voytek.Infrastructure.Persistence;

namespace Voytek.Infrastructure.Authorizations;

public sealed record AuthorizationEvaluationInput(
    Guid AgentId,
    Guid ObjectiveId,
    Guid BudgetId,
    string ActionType,
    decimal Amount,
    string Currency,
    string Purpose,
    string IdempotencyKey,
    bool ShadowMode);

public sealed class AuthorizationDecisionService(VoytekDbContext dbContext)
{
    public async Task<AuthorizationRequest> EvaluateAsync(
        AuthorizationEvaluationInput input,
        CancellationToken cancellationToken)
    {
        var actionType = input.ActionType.Trim();
        var currency = input.Currency.Trim().ToUpperInvariant();
        var purpose = input.Purpose.Trim();
        var idempotencyKey = input.IdempotencyKey.Trim();

        var existing = await dbContext.AuthorizationRequests
            .SingleOrDefaultAsync(item => item.IdempotencyKey == idempotencyKey, cancellationToken);

        if (existing is not null)
        {
            if (!Matches(existing, input, actionType, currency, purpose, idempotencyKey))
            {
                throw new InvalidOperationException("The idempotency key was already used for a different authorization request.");
            }

            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var request = new AuthorizationRequest(
            Guid.NewGuid(),
            dbContext.CurrentTenantId,
            input.AgentId,
            input.ObjectiveId,
            input.BudgetId,
            actionType,
            input.Amount,
            currency,
            purpose,
            idempotencyKey,
            input.ShadowMode,
            now);
        dbContext.AuthorizationRequests.Add(request);

        var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == input.AgentId, cancellationToken);
        var objective = await dbContext.Objectives.SingleOrDefaultAsync(item => item.Id == input.ObjectiveId, cancellationToken);
        var budget = await dbContext.Budgets.SingleOrDefaultAsync(item => item.Id == input.BudgetId, cancellationToken);

        if (agent is null || agent.Status != AgentStatus.Active || agent.KillSwitchActivatedAtUtc is not null)
        {
            request.Decide(AuthorizationDecision.Deny, "Agent is not eligible to perform sensitive actions.", now);
        }
        else if (objective is null || objective.AgentId != agent.Id || objective.Status != ObjectiveStatus.Active)
        {
            request.Decide(AuthorizationDecision.Deny, "Objective is not active for the agent.", now);
        }
        else if (budget is null || budget.AgentId != agent.Id || budget.ObjectiveId != objective.Id || budget.Currency != currency)
        {
            request.Decide(AuthorizationDecision.Deny, "Budget does not match the requested action.", now);
        }
        else if (budget.Status != BudgetStatus.Active)
        {
            request.Decide(AuthorizationDecision.Deny, "Budget is not active.", now);
        }
        else if (input.Amount <= 0 || input.Amount > budget.AvailableAmount)
        {
            request.Decide(AuthorizationDecision.Deny, "Budget has insufficient available amount.", now);
        }
        else
        {
            var policies = await dbContext.Policies
                .Where(policy => policy.AgentId == agent.Id && policy.ActionType == actionType && policy.IsActive)
                .ToListAsync(cancellationToken);

            if (policies.Count == 0)
            {
                request.Decide(AuthorizationDecision.Deny, "No active policy permits this action.", now);
            }
            else if (policies.Any(policy => policy.MaximumAmount is not null && input.Amount > policy.MaximumAmount))
            {
                request.Decide(AuthorizationDecision.Deny, "Amount exceeds the policy maximum.", now);
            }
            else if (agent.AutonomyLevel == AutonomyLevel.Manual)
            {
                request.Decide(AuthorizationDecision.HumanApproval, "Manual autonomy requires human approval.", now);
            }
            else if (policies.Any(policy => policy.ApprovalThreshold is not null && input.Amount > policy.ApprovalThreshold))
            {
                request.Decide(AuthorizationDecision.HumanApproval, "Amount requires human approval.", now);
            }
            else
            {
                request.Decide(
                    AuthorizationDecision.Allow,
                    input.ShadowMode
                        ? "Action is allowed in shadow mode; no budget was reserved."
                        : "Action is within the active policy and budget limits.",
                    now);
            }
        }

        if (input.ShadowMode)
        {
            dbContext.ShadowActions.Add(new ShadowAction(
                Guid.NewGuid(),
                dbContext.CurrentTenantId,
                request.Id,
                request.Decision,
                now));
        }
        else if (request.Decision == AuthorizationDecision.HumanApproval)
        {
            dbContext.ApprovalRequests.Add(new ApprovalRequest(
                Guid.NewGuid(),
                dbContext.CurrentTenantId,
                request.Id,
                now));
        }
        else if (request.Decision == AuthorizationDecision.Allow)
        {
            budget!.Reserve(input.Amount, now);
            dbContext.LedgerEntries.Add(new LedgerEntry(
                Guid.NewGuid(),
                dbContext.CurrentTenantId,
                agent!.Id,
                objective!.Id,
                budget.Id,
                request.Id,
                input.Amount,
                budget.Currency,
                LedgerEntryType.BudgetReserved,
                idempotencyKey,
                now));
        }

        dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(),
            dbContext.CurrentTenantId,
            null,
            $"authorization.{request.Decision}",
            "AuthorizationRequest",
            request.Id,
            idempotencyKey,
            now));

        await dbContext.SaveChangesAsync(cancellationToken);
        return request;
    }

    private static bool Matches(
        AuthorizationRequest existing,
        AuthorizationEvaluationInput input,
        string actionType,
        string currency,
        string purpose,
        string idempotencyKey) =>
        existing.AgentId == input.AgentId &&
        existing.ObjectiveId == input.ObjectiveId &&
        existing.BudgetId == input.BudgetId &&
        string.Equals(existing.ActionType, actionType, StringComparison.Ordinal) &&
        existing.Amount == input.Amount &&
        string.Equals(existing.Currency, currency, StringComparison.Ordinal) &&
        string.Equals(existing.Purpose, purpose, StringComparison.Ordinal) &&
        string.Equals(existing.IdempotencyKey, idempotencyKey, StringComparison.Ordinal) &&
        existing.ShadowMode == input.ShadowMode;
}
