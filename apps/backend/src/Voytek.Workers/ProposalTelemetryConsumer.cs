using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Voytek.Application.AI;
using Voytek.Infrastructure.Eventing;

namespace Voytek.Workers;

public sealed class ProposalTelemetryConsumer(
    IConfiguration configuration,
    ILogger<ProposalTelemetryConsumer> logger) : BackgroundService
{
    private const string DeadLetterQueue = "voytek.agent-proposals.generated.dead";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var brokerConnection = configuration.GetConnectionString("RabbitMQ");
        if (!Uri.TryCreate(brokerConnection, UriKind.Absolute, out var brokerUri))
        {
            logger.LogInformation("RabbitMQ is not configured; the proposal telemetry worker is idle.");
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
            return;
        }

        var factory = new ConnectionFactory { Uri = brokerUri, AutomaticRecoveryEnabled = true };
        await using var connection = await factory.CreateConnectionAsync(stoppingToken);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.QueueDeclareAsync(
            queue: DeadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null,
            cancellationToken: stoppingToken);

        var queueArguments = new Dictionary<string, object?>
        {
            ["x-dead-letter-exchange"] = string.Empty,
            ["x-dead-letter-routing-key"] = DeadLetterQueue
        };
        await channel.QueueDeclareAsync(
            queue: RabbitMqAgentProposalEventPublisher.QueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: queueArguments,
            cancellationToken: stoppingToken);
        await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, delivery) =>
        {
            try
            {
                var message = JsonSerializer.Deserialize<AgentProposalGeneratedEvent>(delivery.Body.Span)
                    ?? throw new JsonException("The proposal telemetry message is empty.");
                if (message.EventId == Guid.Empty || string.IsNullOrWhiteSpace(message.Provider))
                {
                    throw new JsonException("The proposal telemetry message is invalid.");
                }

                logger.LogInformation(
                    "Processed proposal telemetry event {EventId}: provider {Provider}, model {Model}, input tokens {InputTokens}, output tokens {OutputTokens}.",
                    message.EventId,
                    message.Provider,
                    message.Model,
                    message.InputTokens,
                    message.OutputTokens);
                await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Rejecting an invalid proposal telemetry message.");
                await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false, cancellationToken: stoppingToken);
            }
        };

        await channel.BasicConsumeAsync(
            queue: RabbitMqAgentProposalEventPublisher.QueueName,
            autoAck: false,
            consumerTag: string.Empty,
            noLocal: false,
            exclusive: false,
            arguments: null,
            consumer: consumer,
            cancellationToken: stoppingToken);

        logger.LogInformation("Voytek proposal telemetry worker is consuming RabbitMQ messages.");
        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
    }
}
