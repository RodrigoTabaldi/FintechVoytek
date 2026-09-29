using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

public sealed class RedisAgentProposalRateLimiter(
    IConnectionMultiplexer connectionMultiplexer,
    ILogger<RedisAgentProposalRateLimiter> logger) : IAgentProposalRateLimiter
{
    private const int PermitLimit = 5;
    private const int WindowSeconds = 60;
    private const string IncrementScript = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count";
    private readonly IDatabase _database = connectionMultiplexer.GetDatabase();

    public async Task<bool> IsAllowedAsync(string partitionKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var window = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / WindowSeconds;
        var partitionHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(partitionKey))).ToLowerInvariant();
        var key = $"voytek:rate:ai-proposals:v1:{partitionHash}:{window}";

        try
        {
            var count = (long)await _database.ScriptEvaluateAsync(
                IncrementScript,
                [key],
                [WindowSeconds]).WaitAsync(cancellationToken);
            return count <= PermitLimit;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Distributed proposal rate limit is unavailable; using the API process-local limit.");
            return true;
        }
    }
}
