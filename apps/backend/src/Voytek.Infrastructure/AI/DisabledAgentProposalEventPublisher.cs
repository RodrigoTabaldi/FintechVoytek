using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

public sealed class DisabledAgentProposalEventPublisher : IAgentProposalEventPublisher
{
    public Task PublishAsync(AgentProposalGeneratedEvent proposalEvent, CancellationToken cancellationToken) =>
        Task.CompletedTask;
}
