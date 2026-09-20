namespace Voytek.Infrastructure.AI;

public sealed class LlmOptions
{
    public const string SectionName = "AI";
    public string Provider { get; init; } = "disabled";
    public string Model { get; init; } = "";
    public int TimeoutSeconds { get; init; } = 30;
    public string? ApiKey { get; set; }
}
