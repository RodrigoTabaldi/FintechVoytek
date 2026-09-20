using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Voytek.Application.AI;

namespace Voytek.Infrastructure.AI;

public sealed class OpenAiLlmProvider(HttpClient httpClient, IOptions<LlmOptions> options) : ILLMProvider
{
    private const string SystemInstruction = "You create operational proposals for Voytek agents. You may analyze and recommend, but you must never claim to authorize, approve, reserve, spend, transfer, or execute an action. Return concise plain text.";

    public async Task<LlmProposalResponse> ProposeAsync(LlmProposalRequest request, CancellationToken cancellationToken)
    {
        var apiKey = options.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("OPENAI_API_KEY must be configured for the OpenAI provider.");
        }

        using var message = new HttpRequestMessage(HttpMethod.Post, "responses")
        {
            Content = JsonContent.Create(new
            {
                model = string.IsNullOrWhiteSpace(options.Value.Model) ? "gpt-5.6-luna" : options.Value.Model,
                instructions = SystemInstruction,
                input = request.Instruction,
                max_output_tokens = 800
            })
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        message.Headers.Add("X-Client-Request-Id", request.CorrelationId);

        using var response = await httpClient.SendAsync(message, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("The OpenAI proposal request was rejected.");
        }

        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        var content = GetOutputText(root);
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new InvalidOperationException("OpenAI returned no proposal text.");
        }

        var usage = root.TryGetProperty("usage", out var usageElement) ? usageElement : default;
        return new LlmProposalResponse(
            content,
            "openai",
            root.TryGetProperty("model", out var model) ? model.GetString() ?? options.Value.Model : options.Value.Model,
            usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("input_tokens", out var inputTokens) ? inputTokens.GetInt32() : 0,
            usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty("output_tokens", out var outputTokens) ? outputTokens.GetInt32() : 0,
            null);
    }

    private static string? GetOutputText(JsonElement root)
    {
        if (!root.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var item in output.EnumerateArray())
        {
            if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("type", out var type) && type.GetString() == "output_text" &&
                    part.TryGetProperty("text", out var text))
                {
                    return text.GetString();
                }
            }
        }

        return null;
    }
}
