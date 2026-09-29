using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

/// <summary>
/// Caches only exact, tenant-scoped proposal requests. Authorization and financial writes never use this cache.
/// </summary>
public sealed class CachedLlmProvider(
    ILLMProvider inner,
    IDistributedCache cache,
    IConfiguration configuration,
    ILogger<CachedLlmProvider> logger) : ILLMProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly int _cacheSeconds = Math.Clamp(ParseCacheSeconds(configuration["AI:ProposalCacheSeconds"]), 0, 3_600);

    public async Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken)
    {
        if (_cacheSeconds == 0)
        {
            return await inner.ProposeAsync(request, cancellationToken);
        }

        var key = CreateKey(request, configuration["AI:Model"]);
        try
        {
            var cached = await cache.GetStringAsync(key, cancellationToken);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                try
                {
                    var response = JsonSerializer.Deserialize<LlmProposalResponse>(cached, JsonOptions);
                    if (response is not null)
                    {
                        return response with { Cached = true };
                    }
                }
                catch (JsonException)
                {
                    await cache.RemoveAsync(key, cancellationToken);
                }
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Proposal cache read failed; generating a fresh proposal.");
        }

        var generated = await inner.ProposeAsync(request, cancellationToken);
        try
        {
            await cache.SetStringAsync(
                key,
                JsonSerializer.Serialize(generated, JsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_cacheSeconds)
                },
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Proposal cache write failed; returning the generated proposal.");
        }

        return generated;
    }

    private static string CreateKey(LlmProposalRequest request, string? model)
    {
        var identity = JsonSerializer.Serialize(new
        {
            request.TenantId,
            request.AgentId,
            Model = model,
            request.Instruction,
            request.RetrievedContext
        });
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity))).ToLowerInvariant();
        return $"voytek:llm-proposal:v1:{digest}";
    }

    private static int ParseCacheSeconds(string? value) =>
        int.TryParse(value, out var seconds) ? seconds : 30;
}
