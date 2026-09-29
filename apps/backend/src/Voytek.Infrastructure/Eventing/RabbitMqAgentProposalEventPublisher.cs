using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using Voytek.Application.AI;

namespace Voytek.Infrastructure.Eventing;

public sealed class RabbitMqAgentProposalEventPublisher(
    IConfiguration configuration,
    ILogger<RabbitMqAgentProposalEventPublisher> logger) : IAgentProposalEventPublisher
{
    public const string QueueName = "voytek.agent-proposals.generated";

    public async Task PublishAsync(AgentProposalGeneratedEvent proposalEvent, CancellationToken cancellationToken)
    {
        var brokerUri = configuration.GetConnectionString("RabbitMQ");
        if (!Uri.TryCreate(brokerUri, UriKind.Absolute, out var uri))
        {
            return;
        }

        try
        {
            var factory = new ConnectionFactory { Uri = uri, AutomaticRecoveryEnabled = true };
            await using var connection = await factory.CreateConnectionAsync(cancellationToken);
            await using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
            await channel.QueueDeclareAsync(
                queue: "voytek.agent-proposals.generated.dead",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null,
                cancellationToken: cancellationToken);
            var queueArguments = new Dictionary<string, object?>
            {
                ["x-dead-letter-exchange"] = string.Empty,
                ["x-dead-letter-routing-key"] = "voytek.agent-proposals.generated.dead"
            };
            await channel.QueueDeclareAsync(
                queue: QueueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: queueArguments,
                cancellationToken: cancellationToken);

            var properties = new BasicProperties
            {
                ContentType = "application/json",
                Persistent = true
            };
            var body = JsonSerializer.SerializeToUtf8Bytes(proposalEvent);
            await channel.BasicPublishAsync(
                exchange: string.Empty,
                routingKey: QueueName,
                mandatory: true,
                basicProperties: properties,
                body: body,
                cancellationToken: cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Could not publish the non-critical proposal telemetry event {EventId}.", proposalEvent.EventId);
        }
    }
}
