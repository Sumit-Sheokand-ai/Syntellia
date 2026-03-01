using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIContentCheckController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AIContentCheckController> _logger;

    public AIContentCheckController(IHttpClientFactory httpClientFactory, ILogger<AIContentCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpPost("check-url")]
    public async Task<IActionResult> CheckUrl([FromBody] UrlCheckRequest request)
    {
        try
        {
            if (request is null ||
                string.IsNullOrWhiteSpace(request.Url) ||
                !Uri.TryCreate(request.Url, UriKind.Absolute, out var parsedUrl) ||
                (parsedUrl.Scheme != Uri.UriSchemeHttp && parsedUrl.Scheme != Uri.UriSchemeHttps))
            {
                return BadRequest(new { Error = "Invalid URL. Please provide a valid http or https URL." });
            }

            var domain = parsedUrl.Host;
            if (string.IsNullOrWhiteSpace(domain) || domain.Length > 255)
            {
                return BadRequest(new { Error = "Invalid domain in URL." });
            }

            var encodedDomain = Uri.EscapeDataString(domain);
            var results = new List<CommonCrawlResult>();

            // Query Common Crawl CDX API
            var crawls = new[] { "CC-MAIN-2024-10", "CC-MAIN-2023-50", "CC-MAIN-2023-23", "CC-MAIN-2022-49" };
            
            foreach (var crawl in crawls)
            {
                try
                {
                    var cdxUrl = $"https://index.commoncrawl.org/{crawl}-index?url={encodedDomain}&output=json";
                    var response = await _httpClient.GetAsync(cdxUrl);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                        
                        foreach (var line in lines.Take(10)) // Limit to 10 records per crawl
                        {
                            try
                            {
                                var record = JsonSerializer.Deserialize<JsonElement>(line);
                                results.Add(new CommonCrawlResult
                                {
                                    Crawl = crawl,
                                    Timestamp = record.GetProperty("timestamp").GetString() ?? "",
                                    Url = record.GetProperty("url").GetString() ?? "",
                                    Status = record.GetProperty("status").GetString() ?? ""
                                });
                            }
                            catch { }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error querying crawl {Crawl}", crawl);
                }
            }

            return Ok(new
            {
                Found = results.Any(),
                TotalRecords = results.Count,
                Crawls = results.GroupBy(r => r.Crawl).Select(g => new
                {
                    Crawl = g.Key,
                    Count = g.Count()
                }).ToList(),
                SampleRecords = results.Take(5).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking URL");
            return BadRequest(new { Error = "Failed to check URL" });
        }
    }

    [HttpPost("check-text")]
    public async Task<IActionResult> CheckText([FromBody] TextCheckRequest request)
    {
        try
        {
            if (request is null || string.IsNullOrWhiteSpace(request.Text))
            {
                return BadRequest(new { Error = "Text is required." });
            }

            var normalizedText = request.Text.Trim();
            if (normalizedText.Length > 5000)
            {
                return BadRequest(new { Error = "Text is too long. Maximum length is 5000 characters." });
            }
            var indexes = new[]
            {
                new { Name = "Dolma (3T tokens)", Index = "v4_dolma-v1_7_llama" },
                new { Name = "RedPajama (1.4T tokens)", Index = "v4_rpj_llama_s4" },
                new { Name = "The Pile (380B tokens)", Index = "v4_piletrain_llama" },
                new { Name = "C4 (200B tokens)", Index = "v4_c4train_llama" }
            };

            var results = new List<InfiniGramResult>();
            var textSnippet = normalizedText.Length > 200 ? normalizedText[..200] : normalizedText;

            foreach (var idx in indexes)
            {
                try
                {
                    var payload = new
                    {
                        index = idx.Index,
                        query_type = "count",
                        query = textSnippet
                    };

                    var content = new StringContent(
                        JsonSerializer.Serialize(payload),
                        Encoding.UTF8,
                        "application/json");

                    var response = await _httpClient.PostAsync("https://api.infini-gram.io/", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadAsStringAsync();
                        var json = JsonSerializer.Deserialize<JsonElement>(result);
                        var count = json.GetProperty("count").GetInt64();

                        results.Add(new InfiniGramResult
                        {
                            IndexName = idx.Name,
                            Count = count,
                            Found = count > 0
                        });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error querying index {Index}", idx.Name);
                }
            }

            return Ok(new
            {
                Found = results.Any(r => r.Found),
                Results = results,
                TextSnippet = textSnippet
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking text");
            return BadRequest(new { Error = "Failed to check text" });
        }
    }

    public record UrlCheckRequest(string Url);
    public record TextCheckRequest(string Text);
    public record CommonCrawlResult
    {
        public string Crawl { get; set; } = "";
        public string Timestamp { get; set; } = "";
        public string Url { get; set; } = "";
        public string Status { get; set; } = "";
    }
    public record InfiniGramResult
    {
        public string IndexName { get; set; } = "";
        public long Count { get; set; }
        public bool Found { get; set; }
    }
}
