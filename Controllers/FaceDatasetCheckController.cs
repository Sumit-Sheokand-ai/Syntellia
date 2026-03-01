using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FaceDatasetCheckController : ControllerBase
{
    private static readonly string[] CrawlIndexes =
    [
        "CC-MAIN-2025-13",
        "CC-MAIN-2024-51",
        "CC-MAIN-2024-26",
        "CC-MAIN-2023-50"
    ];

    private static readonly string[] AllowedMimeTypes =
    [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp"
    ];

    private static readonly Regex UrlRegex =
        new(@"https?://[^\s""'<>\\]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly HttpClient _httpClient;
    private readonly ILogger<FaceDatasetCheckController> _logger;

    public FaceDatasetCheckController(IHttpClientFactory httpClientFactory, ILogger<FaceDatasetCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpPost("check-url")]
    public async Task<IActionResult> CheckImageUrl([FromBody] ImageUrlCheckRequest request)
    {
        try
        {
            if (request is null || !TryNormalizeHttpUrl(request.ImageUrl, out var normalizedImageUrl))
            {
                return BadRequest(new { Error = "Invalid image URL. Please provide a valid http or https URL." });
            }

            var matches = await QueryCommonCrawlByUrlAsync(normalizedImageUrl);
            var found = matches.Count > 0;
            var crawlsWithHits = matches
                .Select(match => match.Crawl)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            return Ok(new
            {
                ImageUrl = normalizedImageUrl,
                CheckedDatasets = new[] { "Common Crawl indexes (proxy signal for LAION-style web-scale training datasets)" },
                Found = found,
                Confidence = GetUrlConfidence(found, crawlsWithHits, matches.Count),
                Message = found
                    ? $"Found exact URL captures in {crawlsWithHits} crawl index(es). Publicly crawled images are commonly ingested into large AI training corpora."
                    : "No exact URL match was found in the checked crawl indexes.",
                Disclaimer = "This endpoint now performs real, deterministic index lookups in Common Crawl. A miss does not guarantee an image was never used in a private or unindexed dataset.",
                Resources = new[]
                {
                    new { Name = "Common Crawl Index", Url = "https://index.commoncrawl.org/" },
                    new { Name = "Spawning / Have I Been Trained", Url = "https://haveibeentrained.com/" }
                },
                Evidence = matches
                    .Take(10)
                    .Select(match => new
                    {
                        match.Crawl,
                        match.Timestamp,
                        match.Status,
                        match.Url
                    })
                    .ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking image URL");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    [HttpPost("check-upload")]
    public async Task<IActionResult> CheckUploadedImage([FromForm] IFormFile image, [FromForm] string? sourceUrl = null)
    {
        try
        {
            if (image == null || image.Length == 0)
            {
                return BadRequest(new { Error = "No image provided" });
            }

            if (image.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { Error = "Image too large. Maximum size is 10MB." });
            }

            var normalizedContentType = image.ContentType?.Trim().ToLowerInvariant() ?? string.Empty;
            if (!AllowedMimeTypes.Contains(normalizedContentType))
            {
                return BadRequest(new { Error = "Invalid image format. Supported: JPEG, PNG, WebP" });
            }

            var stopwatch = Stopwatch.StartNew();

            await using var memoryStream = new MemoryStream();
            await image.CopyToAsync(memoryStream);
            var imageBytes = memoryStream.ToArray();
            var imageHashSha256 = Convert.ToHexString(SHA256.HashData(imageBytes)).ToLowerInvariant();

            var candidateUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(sourceUrl) && TryNormalizeHttpUrl(sourceUrl, out var normalizedSourceUrl))
            {
                candidateUrls.Add(normalizedSourceUrl);
            }

            foreach (var extractedUrl in ExtractPotentialImageUrls(imageBytes))
            {
                candidateUrls.Add(extractedUrl);
            }

            var urlEvidence = new List<object>();
            var totalMatches = 0;
            var crawlsWithHits = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var candidateUrl in candidateUrls.Take(3))
            {
                var matches = await QueryCommonCrawlByUrlAsync(candidateUrl);
                if (matches.Count == 0)
                {
                    continue;
                }

                totalMatches += matches.Count;
                foreach (var crawl in matches.Select(match => match.Crawl).Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    crawlsWithHits.Add(crawl);
                }

                urlEvidence.Add(new
                {
                    Url = candidateUrl,
                    TotalMatches = matches.Count,
                    Crawls = matches
                        .GroupBy(match => match.Crawl)
                        .Select(group => new
                        {
                            Crawl = group.Key,
                            Count = group.Count()
                        })
                        .OrderByDescending(entry => entry.Count)
                        .ToList()
                });
            }

            var found = totalMatches > 0;
            var similarity = found
                ? Math.Round(Math.Min(0.99, 0.60 + (0.08 * crawlsWithHits.Count) + (0.02 * Math.Min(totalMatches, 10))), 3)
                : 0;

            var confidence = found
                ? (crawlsWithHits.Count >= 2 ? "Medium" : "Low")
                : (candidateUrls.Count > 0 ? "Low" : "Insufficient Evidence");

            stopwatch.Stop();

            return Ok(new
            {
                ImageName = image.FileName,
                ImageSize = image.Length,
                CheckedDatasets = new[] { "Common Crawl indexes (proxy signal for web-scale dataset inclusion)" },
                Found = found,
                Similarity = similarity,
                Confidence = confidence,
                Message = found
                    ? "Found crawl-index evidence for source URL(s) detected in upload metadata. This indicates public crawl exposure and possible downstream dataset inclusion."
                    : candidateUrls.Count > 0
                        ? "No crawl-index evidence found for detected source URL(s)."
                        : "No reliable source URL could be extracted from the uploaded image metadata for index lookup.",
                Disclaimer = "Upload checks now run deterministic hash + metadata extraction and real crawl index lookup when URLs are available. This is not a full visual-nearest-neighbor search across all model training datasets.",
                TechnicalDetails = new
                {
                    EmbeddingModel = "N/A (exact URL evidence lookup)",
                    IndexSize = $"{CrawlIndexes.Length} Common Crawl indexes",
                    SearchMethod = "Exact URL lookup via Common Crawl CDX API",
                    ProcessingTime = $"{stopwatch.ElapsedMilliseconds} ms",
                    ImageHashSha256 = imageHashSha256
                },
                CandidateUrlsDetected = candidateUrls.Take(5).ToList(),
                Evidence = urlEvidence
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking uploaded image");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    private async Task<List<CrawlHit>> QueryCommonCrawlByUrlAsync(string imageUrl)
    {
        var results = new List<CrawlHit>();
        var encodedUrl = Uri.EscapeDataString(imageUrl);

        foreach (var crawl in CrawlIndexes)
        {
            try
            {
                var cdxUrl = $"https://index.commoncrawl.org/{crawl}-index?url={encodedUrl}&matchType=exact&output=json&filter=status:200";
                var response = await _httpClient.GetAsync(cdxUrl);

                if (!response.IsSuccessStatusCode)
                {
                    continue;
                }

                var content = await response.Content.ReadAsStringAsync();
                if (string.IsNullOrWhiteSpace(content))
                {
                    continue;
                }

                var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines.Take(25))
                {
                    try
                    {
                        using var document = JsonDocument.Parse(line);
                        var root = document.RootElement;

                        results.Add(new CrawlHit
                        {
                            Crawl = crawl,
                            Timestamp = root.TryGetProperty("timestamp", out var timestampElement)
                                ? timestampElement.GetString() ?? string.Empty
                                : string.Empty,
                            Url = root.TryGetProperty("url", out var urlElement)
                                ? urlElement.GetString() ?? imageUrl
                                : imageUrl,
                            Status = root.TryGetProperty("status", out var statusElement)
                                ? statusElement.GetString() ?? string.Empty
                                : string.Empty
                        });
                    }
                    catch
                    {
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error querying Common Crawl index {Crawl}", crawl);
            }
        }

        return results
            .GroupBy(hit => $"{hit.Crawl}|{hit.Url}|{hit.Timestamp}|{hit.Status}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
    }

    private static IEnumerable<string> ExtractPotentialImageUrls(byte[] imageBytes)
    {
        var extractedUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rawText = Encoding.UTF8.GetString(imageBytes);
        var matches = UrlRegex.Matches(rawText);

        foreach (Match match in matches)
        {
            var candidate = match.Value.Trim().TrimEnd('.', ',', ';', ')', ']', '}', '"', '\'');
            if (!TryNormalizeHttpUrl(candidate, out var normalizedCandidate))
            {
                continue;
            }

            if (!LooksLikeImageUrl(normalizedCandidate))
            {
                continue;
            }

            extractedUrls.Add(normalizedCandidate);
            if (extractedUrls.Count >= 5)
            {
                break;
            }
        }

        return extractedUrls;
    }

    private static bool TryNormalizeHttpUrl(string input, out string normalizedUrl)
    {
        normalizedUrl = string.Empty;

        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        var trimmedInput = input.Trim();
        if (!Uri.TryCreate(trimmedInput, UriKind.Absolute, out var parsedUri))
        {
            return false;
        }

        if (parsedUri.Scheme != Uri.UriSchemeHttp && parsedUri.Scheme != Uri.UriSchemeHttps)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(parsedUri.Host) || parsedUri.Host.Length > 255)
        {
            return false;
        }

        normalizedUrl = parsedUri.AbsoluteUri;
        return normalizedUrl.Length <= 2048;
    }

    private static bool LooksLikeImageUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsedUri))
        {
            return false;
        }

        var path = parsedUri.AbsolutePath.ToLowerInvariant();
        if (path.EndsWith(".jpg", StringComparison.Ordinal) ||
            path.EndsWith(".jpeg", StringComparison.Ordinal) ||
            path.EndsWith(".png", StringComparison.Ordinal) ||
            path.EndsWith(".webp", StringComparison.Ordinal) ||
            path.EndsWith(".gif", StringComparison.Ordinal) ||
            path.EndsWith(".bmp", StringComparison.Ordinal) ||
            path.EndsWith(".avif", StringComparison.Ordinal))
        {
            return true;
        }

        var query = parsedUri.Query.ToLowerInvariant();
        return query.Contains("format=jpg", StringComparison.Ordinal) ||
               query.Contains("format=jpeg", StringComparison.Ordinal) ||
               query.Contains("format=png", StringComparison.Ordinal) ||
               query.Contains("format=webp", StringComparison.Ordinal) ||
               query.Contains(".jpg", StringComparison.Ordinal) ||
               query.Contains(".jpeg", StringComparison.Ordinal) ||
               query.Contains(".png", StringComparison.Ordinal) ||
               query.Contains(".webp", StringComparison.Ordinal);
    }

    private static string GetUrlConfidence(bool found, int crawlsWithHits, int totalMatches)
    {
        if (!found)
        {
            return "No Exact Match";
        }

        if (crawlsWithHits >= 2 || totalMatches >= 3)
        {
            return "High";
        }

        return "Medium";
    }

    private sealed record CrawlHit
    {
        public string Crawl { get; init; } = string.Empty;
        public string Timestamp { get; init; } = string.Empty;
        public string Url { get; init; } = string.Empty;
        public string Status { get; init; } = string.Empty;
    }

    public record ImageUrlCheckRequest(string ImageUrl);
}
