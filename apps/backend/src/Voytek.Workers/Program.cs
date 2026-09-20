using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Voytek.Workers;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<VoytekWorker>();
await builder.Build().RunAsync();
