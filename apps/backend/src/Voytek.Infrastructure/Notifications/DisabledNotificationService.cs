using Voytek.Application.Notifications;

namespace Voytek.Infrastructure.Notifications;

public sealed class DisabledNotificationService : INotificationService
{
    public Task SendAsync(NotificationMessage message, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("No notification provider is configured.");
}
