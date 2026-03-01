using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RobocallCheckController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<RobocallCheckController> _logger;

    public RobocallCheckController(IHttpClientFactory httpClientFactory, ILogger<RobocallCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpGet("check/{phoneNumber}")]
    public async Task<IActionResult> CheckPhoneNumber(string phoneNumber)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(phoneNumber) || phoneNumber.Length > 32)
            {
                return BadRequest(new { Error = "Invalid phone number format. Use a valid international number." });
            }
            var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());
            if (digitsOnly.Length < 6 || digitsOnly.Length > 15)
            {
                return BadRequest(new { Error = "Invalid phone number format. Use a valid international number (6-15 digits)." });
            }

            var queryVariants = new List<string>
            {
                digitsOnly
            };

            if (phoneNumber.TrimStart().StartsWith("+"))
            {
                queryVariants.Add($"+{digitsOnly}");
            }

            if (digitsOnly.StartsWith("00") && digitsOnly.Length > 8)
            {
                queryVariants.Add(digitsOnly[2..]);
            }

            if (digitsOnly.Length == 11 && digitsOnly.StartsWith("1"))
            {
                queryVariants.Add(digitsOnly[1..]);
            }

            if (digitsOnly.Length > 10)
            {
                queryVariants.Add(digitsOnly[^10..]);
            }

            queryVariants = queryVariants
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Distinct(StringComparer.Ordinal)
                .Take(5)
                .ToList();

            var complaints = new List<FCCComplaint>();
            var successfulQueries = 0;
            var failedQueries = new List<object>();
            foreach (var variant in queryVariants)
            {
                var encodedVariant = Uri.EscapeDataString(variant);
                var url = $"https://opendata.fcc.gov/resource/vakf-fz8e.json?caller_id_number={encodedVariant}&$limit=50";
                HttpResponseMessage response;
                try
                {
                    response = await _httpClient.GetAsync(url);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Robocall query request failed for variant {Variant}", variant);
                    failedQueries.Add(new { Variant = variant, Error = "Request failed" });
                    continue;
                }

                if (!response.IsSuccessStatusCode)
                {
                    failedQueries.Add(new { Variant = variant, Error = $"HTTP {(int)response.StatusCode}" });
                    continue;
                }
                successfulQueries++;

                var content = await response.Content.ReadAsStringAsync();
                var variantComplaints = JsonSerializer.Deserialize<List<FCCComplaint>>(content) ?? new List<FCCComplaint>();
                complaints.AddRange(variantComplaints);
            }

            if (successfulQueries == 0)
            {
                return StatusCode(502, new
                {
                    Error = "Unable to query complaint records at the moment.",
                    QueryVariants = queryVariants,
                    FailedQueries = failedQueries
                });
            }

            complaints = complaints
                .GroupBy(c => $"{c.caller_id_number}|{c.DateReceived}|{c.CallType}|{c.ConsumerState}|{c.IssueDescription}")
                .Select(g => g.First())
                .ToList();

            var summary = new
            {
                PhoneNumber = phoneNumber.Trim(),
                TotalComplaints = complaints.Count,
                Spoofed = complaints.Count > 0,
                ComplaintTypes = complaints
                    .GroupBy(c => c.CallType ?? "Unknown")
                    .Select(g => new { Type = g.Key, Count = g.Count() })
                    .OrderByDescending(x => x.Count)
                    .ToList(),
                StateDistribution = complaints
                    .GroupBy(c => c.ConsumerState ?? "Unknown")
                    .Select(g => new { State = g.Key, Count = g.Count() })
                    .OrderByDescending(x => x.Count)
                    .Take(10)
                    .ToList(),
                RecentComplaints = complaints
                    .OrderByDescending(c => c.DateReceived)
                    .Take(5)
                    .Select(c => new
                    {
                        Date = c.DateReceived,
                        Type = c.CallType,
                        State = c.ConsumerState,
                        Subject = c.IssueDescription
                    })
                    .ToList(),
                QueryVariants = queryVariants,
                QueryDiagnostics = new
                {
                    SuccessfulQueries = successfulQueries,
                    FailedQueries = failedQueries
                },
                DataSource = "Public robocall complaint records"
            };

            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking phone number");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    public record FCCComplaint
    {
        public string? caller_id_number { get; set; }
        public string? DateReceived { get; set; }
        public string? CallType { get; set; }
        public string? ConsumerState { get; set; }
        public string? IssueDescription { get; set; }
    }
}
