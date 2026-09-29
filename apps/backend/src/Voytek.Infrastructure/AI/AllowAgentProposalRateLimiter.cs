using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

/// <summary>Uses the API's process-local endpoint limiter when Redis is not configured.</summary>
public sealed class AllowAgentProposalRateLimiter : IAgentProposalRateLimiter
{
    public Task<bool> IsAllowedAsync(string partitionKey, CancellationToken cancellationToken) =>
        Task.FromResult(true);
}
