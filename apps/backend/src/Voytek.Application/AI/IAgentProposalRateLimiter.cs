namespace Voytek.Application.AI;

public interface IAgentProposalRateLimiter
{
    Task<bool> IsAllowedAsync(string partitionKey, CancellationToken cancellationToken);
}
