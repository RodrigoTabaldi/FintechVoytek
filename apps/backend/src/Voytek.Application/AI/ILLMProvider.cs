namespace Voytek.Application.AI;

public sealed record LlmProposalRequest(
    Guid TenantId,
    Guid AgentId,
    string Instruction,
    string CorrelationId,
    string RetrievedContext = "");
public sealed record LlmProposalResponse(
    string Content,
    string Provider,
    string Model,
    int InputTokens,
    int OutputTokens,
    decimal? EstimatedCost,
    bool Cached = false);

/// <summary>Gera propostas; nunca autoriza ou executa ações financeiras.</summary>
public interface ILLMProvider
{
    Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken);
}
