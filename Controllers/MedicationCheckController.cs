using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MedicationCheckController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MedicationCheckController> _logger;

    public MedicationCheckController(IHttpClientFactory httpClientFactory, ILogger<MedicationCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpGet("check")]
    public async Task<IActionResult> CheckMedication([FromQuery] string drugName, [FromQuery] string? manufacturer)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(drugName))
            {
                return BadRequest(new { Error = "Drug name is required." });
            }

            var normalizedDrugName = drugName.Trim();
            if (normalizedDrugName.Length is < 2 or > 100)
            {
                return BadRequest(new { Error = "Drug name must be between 2 and 100 characters." });
            }

            var normalizedManufacturer = manufacturer?.Trim();
            if (!string.IsNullOrEmpty(normalizedManufacturer) && normalizedManufacturer.Length > 120)
            {
                return BadRequest(new { Error = "Manufacturer must be 120 characters or fewer." });
            }

            var escapedDrugName = normalizedDrugName.Replace("\"", "\\\"");
            var baseSearchQuery =
                $"(openfda.brand_name:\"{escapedDrugName}\"+OR+openfda.generic_name:\"{escapedDrugName}\"+OR+openfda.substance_name:\"{escapedDrugName}\")";
            var escapedManufacturer = string.IsNullOrEmpty(normalizedManufacturer)
                ? null
                : normalizedManufacturer.Replace("\"", "\\\"");

            string BuildSearchQuery(bool includeManufacturer)
            {
                if (includeManufacturer && !string.IsNullOrEmpty(escapedManufacturer))
                {
                    return $"{baseSearchQuery}+AND+openfda.manufacturer_name:\"{escapedManufacturer}\"";
                }
                return baseSearchQuery;
            }

            async Task<(FDAResponse? Parsed, bool NotFound, bool Success, int StatusCode)> QueryLabelsAsync(bool includeManufacturer)
            {
                var encodedSearchQuery = Uri.EscapeDataString(BuildSearchQuery(includeManufacturer));
                var url = $"https://api.fda.gov/drug/label.json?search={encodedSearchQuery}&limit=100";
                var response = await _httpClient.GetAsync(url);
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return (null, true, true, (int)response.StatusCode);
                }

                if (!response.IsSuccessStatusCode)
                {
                    return (null, false, false, (int)response.StatusCode);
                }

                var content = await response.Content.ReadAsStringAsync();
                var parsed = JsonSerializer.Deserialize<FDAResponse>(content);
                return (parsed, false, true, (int)response.StatusCode);
            }

            var primaryQuery = await QueryLabelsAsync(includeManufacturer: !string.IsNullOrEmpty(normalizedManufacturer));
            if (!primaryQuery.Success)
            {
                return StatusCode(primaryQuery.StatusCode, new { Error = "Failed to query medication label records" });
            }

            var result = primaryQuery.Parsed;
            var usedManufacturerFilter = !string.IsNullOrEmpty(normalizedManufacturer);

            if ((result?.Results == null || !result.Results.Any()) && !string.IsNullOrEmpty(normalizedManufacturer))
            {
                var fallbackQuery = await QueryLabelsAsync(includeManufacturer: false);
                if (!fallbackQuery.Success)
                {
                    return StatusCode(fallbackQuery.StatusCode, new { Error = "Failed to query medication label records" });
                }

                result = fallbackQuery.Parsed;
                usedManufacturerFilter = false;
            }

            if (result?.Results == null || !result.Results.Any())
            {
                return Ok(new { Found = false, Message = "No medication label records found for this query" });
            }

            var labels = result.Results
                .Where(r => r.EffectiveTime != null)
                .OrderByDescending(r => r.EffectiveTime)
                .ToList();

            var hasFormulaChanges = false;
            var changes = new List<FormulaChange>();

            if (labels.Count > 1)
            {
                for (int i = 0; i < labels.Count - 1; i++)
                {
                    var newer = labels[i];
                    var older = labels[i + 1];

                    var newerIngredients = newer.InactiveIngredient?.FirstOrDefault() ?? "";
                    var olderIngredients = older.InactiveIngredient?.FirstOrDefault() ?? "";

                    if (newerIngredients != olderIngredients && 
                        !string.IsNullOrEmpty(newerIngredients) && 
                        !string.IsNullOrEmpty(olderIngredients))
                    {
                        hasFormulaChanges = true;
                        changes.Add(new FormulaChange
                        {
                            FromDate = older.EffectiveTime,
                            ToDate = newer.EffectiveTime,
                            Changed = true,
                            Summary = "Inactive ingredients changed"
                        });
                    }
                }
            }

            return Ok(new
            {
                Found = true,
                DrugName = normalizedDrugName,
                TotalLabels = labels.Count,
                HasFormulaChanges = hasFormulaChanges,
                Changes = changes,
                CurrentLabel = labels.FirstOrDefault() != null ? new
                {
                    EffectiveDate = labels.First().EffectiveTime,
                    Manufacturer = labels.First().OpenFda?.ManufacturerName?.FirstOrDefault(),
                    InactiveIngredients = labels.First().InactiveIngredient?.FirstOrDefault()
                } : null,
                HistoricalLabels = labels.Select(l => new
                {
                    EffectiveDate = l.EffectiveTime,
                    Manufacturer = l.OpenFda?.ManufacturerName?.FirstOrDefault()
                }).ToList(),
                MatchingStrategy = usedManufacturerFilter
                    ? "Brand/generic/substance match with manufacturer filter"
                    : "Brand/generic/substance match"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking medication");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    public record FDAResponse
    {
        public List<DrugLabel>? Results { get; set; }
    }

    public record DrugLabel
    {
        public string? EffectiveTime { get; set; }
        public List<string>? InactiveIngredient { get; set; }
        public OpenFdaInfo? OpenFda { get; set; }
    }

    public record OpenFdaInfo
    {
        public List<string>? ManufacturerName { get; set; }
        public List<string>? BrandName { get; set; }
    }

    public record FormulaChange
    {
        public string? FromDate { get; set; }
        public string? ToDate { get; set; }
        public bool Changed { get; set; }
        public string Summary { get; set; } = "";
    }
}
