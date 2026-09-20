using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

public sealed class DisabledLlmProvider : ILLMProvider
{
    public Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("No LLM provider is configured. Configure AI provider credentials through environment variables.");
}
