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
            var searchQuery = $"openfda.brand_name:\"{escapedDrugName}\"";
            if (!string.IsNullOrEmpty(normalizedManufacturer))
            {
                var escapedManufacturer = normalizedManufacturer.Replace("\"", "\\\"");
                searchQuery += $"+AND+openfda.manufacturer_name:\"{escapedManufacturer}\"";
            }

            var encodedSearchQuery = Uri.EscapeDataString(searchQuery);
            var url = $"https://api.fda.gov/drug/label.json?search={encodedSearchQuery}&limit=100";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return Ok(new { Found = false, Message = "No FDA records found for this medication" });
                }
                return StatusCode((int)response.StatusCode, new { Error = "Failed to query FDA database" });
            }

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<FDAResponse>(content);

            if (result?.Results == null || !result.Results.Any())
            {
                return Ok(new { Found = false, Message = "No FDA records found for this medication" });
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
                }).ToList()
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
