namespace Voytek.Api.Agents;

public sealed record AgentTemplateResponse(string Id, string Name, string Description, string[] Filters);

public sealed record AgentRunRequest(
    string TemplateId,
    string? Query,
    Dictionary<string, string>? Filters,
    int MaxResults = 10);

public sealed record AgentSearchResult(
    string Title,
    string Link,
    string Source,
    string? Summary,
    DateTimeOffset? PublishedAtUtc);

public sealed record AgentRunResponse(
    Guid AgentId,
    string TemplateId,
    string Query,
    DateTimeOffset ExecutedAtUtc,
    IReadOnlyList<AgentSearchResult> Results);
