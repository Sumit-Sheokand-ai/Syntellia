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
                return BadRequest(new { Error = "Invalid phone number format" });
            }
            // Clean phone number
            var cleanNumber = new string(phoneNumber.Where(char.IsDigit).ToArray());

            if (cleanNumber.Length == 11 && cleanNumber.StartsWith("1"))
            {
                cleanNumber = cleanNumber[1..];
            }

            if (cleanNumber.Length != 10)
            {
                return BadRequest(new { Error = "Invalid phone number format" });
            }

            var url = $"https://opendata.fcc.gov/resource/vakf-fz8e.json?caller_id_number={cleanNumber}&$limit=50";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { Error = "Failed to query FCC database" });
            }

            var content = await response.Content.ReadAsStringAsync();
            var complaints = JsonSerializer.Deserialize<List<FCCComplaint>>(content) ?? new List<FCCComplaint>();

            var summary = new
            {
                PhoneNumber = cleanNumber,
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
                    .ToList()
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
