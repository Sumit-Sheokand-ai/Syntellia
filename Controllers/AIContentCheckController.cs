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

            var normalizedUrl = parsedUrl.AbsoluteUri;
            if (normalizedUrl.Length > 2048)
            {
                return BadRequest(new { Error = "URL is too long. Maximum length is 2048 characters." });
            }

            var results = new List<CommonCrawlResult>();
            var crawlStatus = new List<object>();

            // Query Common Crawl CDX API
            var crawls = new[] { "CC-MAIN-2024-10", "CC-MAIN-2023-50", "CC-MAIN-2023-23", "CC-MAIN-2022-49" };
            var availableCrawls = 0;
            
            foreach (var crawl in crawls)
            {
                try
                {
                    var encodedTarget = Uri.EscapeDataString(normalizedUrl);
                    var cdxUrl = $"https://index.commoncrawl.org/{crawl}-index?url={encodedTarget}&matchType=exact&output=json&filter=status:200";
                    var response = await _httpClient.GetAsync(cdxUrl);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        availableCrawls++;
                        crawlStatus.Add(new { Crawl = crawl, Available = true });
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
                                    Timestamp = record.TryGetProperty("timestamp", out var ts) ? (ts.GetString() ?? string.Empty) : string.Empty,
                                    Url = record.TryGetProperty("url", out var u) ? (u.GetString() ?? string.Empty) : string.Empty,
                                    Status = record.TryGetProperty("status", out var s) ? (s.GetString() ?? string.Empty) : string.Empty
                                });
                            }
                            catch
                            {
                            }
                        }
                    }
                    else
                    {
                        crawlStatus.Add(new { Crawl = crawl, Available = false, Error = $"HTTP {(int)response.StatusCode}" });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error querying crawl {Crawl}", crawl);
                    crawlStatus.Add(new { Crawl = crawl, Available = false, Error = "Request failed" });
                }
            }

            return Ok(new
            {
                Query = normalizedUrl,
                Found = results.Any(),
                TotalRecords = results.Count,
                CheckedCrawls = crawls.Length,
                AvailableCrawls = availableCrawls,
                Crawls = results.GroupBy(r => r.Crawl).Select(g => new
                {
                    Crawl = g.Key,
                    Count = g.Count()
                }).ToList(),
                SampleRecords = results.Take(5).ToList(),
                CrawlStatus = crawlStatus
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
                var resultEntry = new InfiniGramResult
                {
                    IndexName = idx.Name,
                    Count = 0,
                    Found = false
                };
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
                        var count = json.TryGetProperty("count", out var countElement)
                            ? countElement.GetInt64()
                            : 0;

                        resultEntry.Count = count;
                        resultEntry.Found = count > 0;
                    }
                    else
                    {
                        resultEntry.Error = $"HTTP {(int)response.StatusCode}";
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error querying index {Index}", idx.Name);
                    resultEntry.Error = "Unavailable";
                }

                results.Add(resultEntry);
            }

            return Ok(new
            {
                Found = results.Any(r => r.Found),
                Results = results,
                TextSnippet = textSnippet,
                CheckedIndexes = indexes.Length,
                AvailableIndexes = results.Count(r => string.IsNullOrWhiteSpace(r.Error))
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
        public string? Error { get; set; }
    }
}
