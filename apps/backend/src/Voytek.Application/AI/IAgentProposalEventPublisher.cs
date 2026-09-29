namespace Voytek.Application.AI;

public sealed record AgentProposalGeneratedEvent(
    Guid EventId,
    string Provider,
    string Model,
    int InputTokens,
    int OutputTokens,
    string CorrelationId);

public interface IAgentProposalEventPublisher
{
    Task PublishAsync(AgentProposalGeneratedEvent proposalEvent, CancellationToken cancellationToken);
}
