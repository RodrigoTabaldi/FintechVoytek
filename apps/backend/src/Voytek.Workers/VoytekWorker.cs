using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Voytek.Workers;

/// <summary>Host para tarefas futuras de integração e notificação.</summary>
public sealed class VoytekWorker(ILogger<VoytekWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Voytek worker started; no asynchronous jobs are configured yet.");
        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
    }
}
