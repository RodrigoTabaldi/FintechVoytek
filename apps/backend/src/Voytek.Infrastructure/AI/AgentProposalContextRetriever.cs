using Voytek.Domain.Agents;
using Voytek.Domain.Objectives;
using Voytek.Domain.Policies;
using Voytek.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Voytek.Infrastructure.AI;

/// <summary>
/// Retrieves a small, tenant-scoped set of operational references for proposal generation.
/// Authorization decisions continue to be made by the deterministic policy engine.
/// </summary>
public sealed class AgentProposalContextRetriever(VoytekDbContext dbContext)
{
    private const int MaximumContextCharacters = 4_000;

    public async Task<string> RetrieveAsync(Agent agent, string instruction, CancellationToken cancellationToken)
    {
        var terms = instruction
            .Split([' ', '\t', '\r', '\n', ',', '.', ';', ':', '/', '-', '_'], StringSplitOptions.RemoveEmptyEntries)
            .Select(term => new string(term.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant())
            .Where(term => term.Length >= 3)
            .Distinct(StringComparer.Ordinal)
            .Take(24)
            .ToArray();

        var objectives = await dbContext.Objectives
            .AsNoTracking()
            .Where(objective => objective.AgentId == agent.Id && objective.Status == ObjectiveStatus.Active)
            .OrderByDescending(objective => objective.UpdatedAtUtc)
            .Take(30)
            .ToListAsync(cancellationToken);

        var policies = await dbContext.Policies
            .AsNoTracking()
            .Where(policy => policy.AgentId == agent.Id && policy.IsActive)
            .OrderByDescending(policy => policy.UpdatedAtUtc)
            .Take(30)
            .ToListAsync(cancellationToken);

        var references = new List<(string Label, string Text, int Score)>();
        references.AddRange(objectives.Select(objective =>
        {
            var text = $"Objective: {objective.Name}. {objective.Description}";
            return ("Objective", text, Score(text, terms));
        }));
        references.AddRange(policies.Select(policy =>
        {
            var text = $"Policy: {policy.Name}. Action type: {policy.ActionType}.";
            return ("Policy", text, Score(text, terms));
        }));

        var selected = references
            .Where(reference => reference.Score > 0)
            .OrderByDescending(reference => reference.Score)
            .ThenBy(reference => reference.Label, StringComparer.Ordinal)
            .Take(6)
            .Select(reference => reference.Text);

        var context = string.Join(
            "\n",
            new[] { $"Agent: {agent.Name}. {agent.Description}" }
                .Concat(selected)
                .Where(line => !string.IsNullOrWhiteSpace(line)));

        return context.Length <= MaximumContextCharacters
            ? context
            : context[..MaximumContextCharacters];
    }

    private static int Score(string text, IReadOnlyCollection<string> terms) =>
        terms.Count(term => text.Contains(term, StringComparison.OrdinalIgnoreCase));
}
