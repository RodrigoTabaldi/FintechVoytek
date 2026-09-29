using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Voytek.Application.AI;
using Voytek.Infrastructure.AI;
using Xunit;

namespace Voytek.UnitTests.AI;

public sealed class CachedLlmProviderTests
{
    [Fact]
    public async Task CachesExactRequestsWithoutSharingAcrossTenantsOrContext()
    {
        var inner = new RecordingLlmProvider();
        var provider = CreateProvider(inner, new TestDistributedCache());
        var request = new LlmProposalRequest(Guid.NewGuid(), Guid.NewGuid(), "review vendor", "first", "Policy: vendor review");

        var first = await provider.ProposeAsync(request, CancellationToken.None);
        var repeated = await provider.ProposeAsync(request with { CorrelationId = "second" }, CancellationToken.None);
        var otherTenant = await provider.ProposeAsync(request with { TenantId = Guid.NewGuid() }, CancellationToken.None);
        var changedContext = await provider.ProposeAsync(request with { RetrievedContext = "Policy: updated vendor review" }, CancellationToken.None);

        Assert.False(first.Cached);
        Assert.True(repeated.Cached);
        Assert.False(otherTenant.Cached);
        Assert.False(changedContext.Cached);
        Assert.Equal(3, inner.Calls);
    }

    [Fact]
    public async Task DisabledCacheCallsProviderForEveryRequest()
    {
        var inner = new RecordingLlmProvider();
        var provider = CreateProvider(inner, new TestDistributedCache(), cacheSeconds: 0);
        var request = new LlmProposalRequest(Guid.NewGuid(), Guid.NewGuid(), "review vendor", "trace", "context");

        await provider.ProposeAsync(request, CancellationToken.None);
        await provider.ProposeAsync(request, CancellationToken.None);

        Assert.Equal(2, inner.Calls);
    }

    [Fact]
    public async Task CacheFailureDoesNotBlockProposalGeneration()
    {
        var inner = new RecordingLlmProvider();
        var provider = CreateProvider(inner, new FailingDistributedCache());
        var request = new LlmProposalRequest(Guid.NewGuid(), Guid.NewGuid(), "review vendor", "trace", "context");

        var result = await provider.ProposeAsync(request, CancellationToken.None);

        Assert.Equal("A proposal", result.Content);
        Assert.Equal(1, inner.Calls);
    }

    private static CachedLlmProvider CreateProvider(
        ILLMProvider inner,
        IDistributedCache cache,
        int cacheSeconds = 30)
    {
        var configuration = new ConfigurationManager
        {
            ["AI:ProposalCacheSeconds"] = cacheSeconds.ToString(),
            ["AI:Model"] = "test-model"
        };
        return new CachedLlmProvider(inner, cache, configuration, NullLogger<CachedLlmProvider>.Instance);
    }

    private sealed class RecordingLlmProvider : ILLMProvider
    {
        public int Calls { get; private set; }

        public Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new LlmProposalResponse("A proposal", "test", "test-model", 4, 2, null));
        }
    }

    private class TestDistributedCache : IDistributedCache
    {
        private readonly ConcurrentDictionary<string, byte[]> _values = new(StringComparer.Ordinal);

        public byte[]? Get(string key) => _values.TryGetValue(key, out var value) ? [.. value] : null;

        public Task<byte[]?> GetAsync(string key, CancellationToken token = default)
        {
            token.ThrowIfCancellationRequested();
            return Task.FromResult(Get(key));
        }

        public void Refresh(string key)
        {
        }

        public Task RefreshAsync(string key, CancellationToken token = default)
        {
            token.ThrowIfCancellationRequested();
            return Task.CompletedTask;
        }

        public void Remove(string key) => _values.TryRemove(key, out _);

        public Task RemoveAsync(string key, CancellationToken token = default)
        {
            token.ThrowIfCancellationRequested();
            Remove(key);
            return Task.CompletedTask;
        }

        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) => _values[key] = [.. value];

        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default)
        {
            token.ThrowIfCancellationRequested();
            Set(key, value, options);
            return Task.CompletedTask;
        }
    }

    private sealed class FailingDistributedCache : IDistributedCache
    {
        public byte[]? Get(string key) => throw new InvalidOperationException("Cache unavailable.");
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => throw new InvalidOperationException("Cache unavailable.");
        public void Refresh(string key) => throw new InvalidOperationException("Cache unavailable.");
        public Task RefreshAsync(string key, CancellationToken token = default) => throw new InvalidOperationException("Cache unavailable.");
        public void Remove(string key) => throw new InvalidOperationException("Cache unavailable.");
        public Task RemoveAsync(string key, CancellationToken token = default) => throw new InvalidOperationException("Cache unavailable.");
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) => throw new InvalidOperationException("Cache unavailable.");
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default) => throw new InvalidOperationException("Cache unavailable.");
    }
}
