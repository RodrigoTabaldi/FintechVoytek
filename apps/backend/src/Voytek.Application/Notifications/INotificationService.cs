namespace Voytek.Application.Notifications;

public sealed record NotificationMessage(Guid TenantId, string Recipient, string Subject, string Body, string CorrelationId);

public interface INotificationService
{
    Task SendAsync(NotificationMessage message, CancellationToken cancellationToken);
}
