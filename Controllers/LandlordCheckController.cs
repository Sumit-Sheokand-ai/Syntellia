using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LandlordCheckController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<LandlordCheckController> _logger;

    public LandlordCheckController(IHttpClientFactory httpClientFactory, ILogger<LandlordCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpGet("check")]
    public async Task<IActionResult> CheckLandlord([FromQuery] string query, [FromQuery] string city = "nyc")
    {
        try
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return BadRequest(new { Error = "Landlord name or address is required." });
            }

            var normalizedQuery = query.Trim();
            if (normalizedQuery.Length is < 2 or > 120)
            {
                return BadRequest(new { Error = "Query must be between 2 and 120 characters." });
            }

            var normalizedCity = city.Trim().ToLowerInvariant();
            if (normalizedCity != "nyc")
            {
                return Ok(new
                {
                    Found = false,
                    Message = "Currently only NYC data is available. Support for other cities coming soon.",
                    SupportedCities = new[] { "NYC" }
                });
            }

            var results = new List<object>();
            var totalViolations = 0;
            var totalLitigations = 0;
            var encodedQuery = Uri.EscapeDataString(normalizedQuery);

            // Query NYC HPD Violations
            try
            {
                var violationsUrl = $"https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$limit=100&$q={encodedQuery}";
                var response = await _httpClient.GetAsync(violationsUrl);

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var violations = JsonSerializer.Deserialize<List<JsonElement>>(content);
                    totalViolations = violations?.Count ?? 0;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error querying HPD violations");
            }

            // Query NYC HPD Litigation
            try
            {
                var litigationUrl = $"https://data.cityofnewyork.us/resource/59kj-x8nc.json?$limit=100&$q={encodedQuery}";
                var response = await _httpClient.GetAsync(litigationUrl);

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var litigations = JsonSerializer.Deserialize<List<JsonElement>>(content);
                    totalLitigations = litigations?.Count ?? 0;

                    if (litigations != null)
                    {
                        foreach (var lit in litigations.Take(10))
                        {
                            results.Add(new
                            {
                                Type = "Litigation",
                                CaseType = lit.TryGetProperty("casetype", out var ct) ? ct.GetString() : "Unknown",
                                CaseOpenDate = lit.TryGetProperty("caseopendate", out var cod) ? cod.GetString() : "Unknown",
                                Status = lit.TryGetProperty("litigationstatus", out var ls) ? ls.GetString() : "Unknown"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error querying HPD litigation");
            }

            var hasCases = totalViolations > 0 || totalLitigations > 0;

            return Ok(new
            {
                Found = hasCases,
                Query = normalizedQuery,
                City = "NYC",
                Summary = new
                {
                    TotalViolations = totalViolations,
                    TotalLitigations = totalLitigations,
                    RiskLevel = GetRiskLevel(totalViolations, totalLitigations)
                },
                RecentCases = results,
                Message = hasCases 
                    ? $"Found {totalViolations} housing violations and {totalLitigations} litigation cases."
                    : "No housing violations or litigation cases found in NYC records.",
                Disclaimer = "Data is specific to NYC (Housing Preservation & Development). Other jurisdictions may have separate records not included here."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking landlord");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    private static string GetRiskLevel(int violations, int litigations)
    {
        var total = violations + litigations;
        if (total == 0) return "No Records";
        if (total < 5) return "Low";
        if (total < 20) return "Moderate";
        if (total < 50) return "High";
        return "Very High";
    }
}
