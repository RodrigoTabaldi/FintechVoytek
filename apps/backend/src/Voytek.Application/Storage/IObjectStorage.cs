namespace Voytek.Application.Storage;

public interface IObjectStorage
{
    Task<string> StoreAsync(Stream content, string contentType, CancellationToken cancellationToken);
}
