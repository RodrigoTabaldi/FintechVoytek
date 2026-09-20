using Voytek.Application.Storage;

namespace Voytek.Infrastructure.Storage;

public sealed class DisabledObjectStorage : IObjectStorage
{
    public Task<string> StoreAsync(Stream content, string contentType, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("No object storage provider is configured.");
}
