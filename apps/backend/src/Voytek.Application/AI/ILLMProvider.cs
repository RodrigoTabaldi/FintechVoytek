namespace Voytek.Application.AI;

public sealed record LlmProposalRequest(Guid TenantId, Guid AgentId, string Instruction, string CorrelationId);
public sealed record LlmProposalResponse(string Content, string Provider, string Model, int InputTokens, int OutputTokens, decimal? EstimatedCost);

/// <summary>Gera propostas; nunca autoriza ou executa ações financeiras.</summary>
public interface ILLMProvider
{
    Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken);
}
