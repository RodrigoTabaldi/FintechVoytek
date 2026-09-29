using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Voytek.Workers;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<ProposalTelemetryConsumer>();
await builder.Build().RunAsync();
