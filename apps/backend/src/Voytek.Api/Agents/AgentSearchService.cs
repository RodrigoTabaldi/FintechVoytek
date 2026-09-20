using System.Net;
using System.Xml.Linq;

namespace Voytek.Api.Agents;

public sealed class AgentSearchService(IHttpClientFactory httpClientFactory)
{
    private static readonly IReadOnlyList<AgentTemplateResponse> Templates =
    [
        new("jobs", "Buscar empregos", "Encontra vagas compatíveis com cargo, tecnologia, local e modalidade.", ["cargo", "palavras-chave", "localização", "modalidade", "senioridade", "salário mínimo", "contrato"]),
        new("tech-news", "Notícias de tecnologia", "Monitora notícias recentes sobre tecnologia e desenvolvimento.", ["tema", "fontes", "período"]),
        new("finance-news", "Notícias do mercado", "Acompanha economia, negócios, investimentos e empresas.", ["tema", "empresa", "mercado", "período"]),
        new("competitors", "Monitorar concorrentes", "Encontra novidades, lançamentos e movimentações de concorrentes.", ["concorrentes", "setor", "região"]),
        new("price-watch", "Pesquisar preços", "Pesquisa ofertas e variações de preço de produtos.", ["produto", "marca", "preço máximo", "loja"]),
        new("courses", "Cursos e certificações", "Encontra cursos, bolsas, eventos e certificações.", ["tema", "nível", "formato", "gratuito"]),
        new("tenders", "Licitações e editais", "Monitora editais, licitações e oportunidades públicas.", ["órgão", "categoria", "localização"]),
        new("real-estate", "Imóveis", "Pesquisa imóveis para comprar ou alugar.", ["tipo", "localização", "preço máximo", "quartos"]),
        new("vehicles", "Veículos", "Encontra veículos anunciados conforme os filtros.", ["marca", "modelo", "ano mínimo", "preço máximo"]),
        new("deals", "Produtos em promoção", "Monitora promoções e descontos em lojas.", ["produto", "categoria", "preço máximo"]),
        new("research", "Pesquisa com fontes", "Pesquisa um assunto e retorna links para leitura.", ["tema", "profundidade", "fontes preferidas"]),
        new("trends", "Monitorar tendências", "Acompanha assuntos emergentes e mudanças no mercado.", ["tema", "região", "período"])
    ];

    public static IReadOnlyList<AgentTemplateResponse> ListTemplates() => Templates;

    public async Task<AgentRunResponse> RunAsync(Guid agentId, AgentRunRequest request, CancellationToken cancellationToken)
    {
        var template = Templates.SingleOrDefault(item => item.Id == request.TemplateId)
            ?? throw new ArgumentException("Unknown agent template.", nameof(request.TemplateId));
        var maxResults = Math.Clamp(request.MaxResults, 1, 25);
        var query = BuildQuery(template, request.Query, request.Filters);
        var encodedQuery = Uri.EscapeDataString(query);
        var client = httpClientFactory.CreateClient("agent-search");
        var rss = await client.GetStringAsync($"https://news.google.com/rss/search?q={encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419", cancellationToken);
        var results = ParseRss(rss, maxResults);
        return new AgentRunResponse(agentId, template.Id, query, DateTimeOffset.UtcNow, results);
    }

    private static string BuildQuery(AgentTemplateResponse template, string? query, Dictionary<string, string>? filters)
    {
        var parts = new List<string> { query?.Trim() ?? string.Empty };
        if (filters is not null)
        {
            parts.AddRange(filters.Where(item => !string.IsNullOrWhiteSpace(item.Value)).Select(item => $"{item.Key}: {item.Value.Trim()}"));
            if (filters.TryGetValue("sites", out var sites) && !string.IsNullOrWhiteSpace(sites))
            {
                var domains = sites.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(site => site.Replace("https://", string.Empty, StringComparison.OrdinalIgnoreCase).Replace("www.", string.Empty, StringComparison.OrdinalIgnoreCase).Trim('/'))
                    .Where(site => site.Contains('.', StringComparison.Ordinal))
                    .Take(8)
                    .Select(site => $"site:{site}");
                parts.Add($"({string.Join(" OR ", domains)})");
            }
        }
        if (template.Id == "jobs") parts.Add("vagas emprego contratação");
        return string.Join(' ', parts.Where(item => !string.IsNullOrWhiteSpace(item)));
    }

    private static IReadOnlyList<AgentSearchResult> ParseRss(string xml, int maxResults)
    {
        var document = XDocument.Parse(xml);
        return document.Descendants("item").Take(maxResults).Select(item =>
        {
            var link = item.Element("link")?.Value?.Trim() ?? string.Empty;
            var title = WebUtility.HtmlDecode(item.Element("title")?.Value?.Trim() ?? "Sem título");
            var summary = WebUtility.HtmlDecode(item.Element("description")?.Value?.Trim() ?? string.Empty);
            DateTimeOffset? published = DateTimeOffset.TryParse(item.Element("pubDate")?.Value, out var value) ? value : null;
            return new AgentSearchResult(title, link, ExtractSource(title), StripMarkup(summary), published);
        }).Where(item => Uri.TryCreate(item.Link, UriKind.Absolute, out _)).ToArray();
    }

    private static string ExtractSource(string title) => title.Split(" - ", StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "Fonte externa";
    private static string? StripMarkup(string text) => string.IsNullOrWhiteSpace(text) ? null : System.Text.RegularExpressions.Regex.Replace(text, "<.*?>", string.Empty).Trim();
}
