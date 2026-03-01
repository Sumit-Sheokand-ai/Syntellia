using Microsoft.AspNetCore.Mvc;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class JobScreeningCheckController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<JobScreeningCheckController> _logger;

    // Static ATS vendor detection patterns
    private static readonly Dictionary<string, string> ATSPatterns = new()
    {
        { "greenhouse.io", "Greenhouse" },
        { "lever.co", "Lever" },
        { "workday.com", "Workday" },
        { "icims.com", "iCIMS" },
        { "taleo.net", "Oracle Taleo" },
        { "bamboohr.com", "BambooHR" },
        { "ashby.com", "Ashby" },
        { "smartrecruiters.com", "SmartRecruiters" },
        { "jobvite.com", "Jobvite" },
        { "myworkdayjobs.com", "Workday" },
        { "applytojob.com", "Taleo" },
        { "breezy.hr", "Breezy HR" },
        { "recruitee.com", "Recruitee" }
    };

    public JobScreeningCheckController(IHttpClientFactory httpClientFactory, ILogger<JobScreeningCheckController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
    }

    [HttpPost("check")]
    public async Task<IActionResult> CheckCompany([FromBody] JobCheckRequest request)
    {
        try
        {
            string? detectedATS = null;
            string? detectionMethod = null;

            // Try to detect from URL
            if (!string.IsNullOrEmpty(request.CareersUrl))
            {
                try
                {
                    var uri = new Uri(request.CareersUrl);
                    var host = uri.Host.ToLower();
                    
                    foreach (var (pattern, vendor) in ATSPatterns)
                    {
                        if (host.Contains(pattern))
                        {
                            detectedATS = vendor;
                            detectionMethod = "URL pattern match";
                            break;
                        }
                    }

                    // Try to fetch the page and detect from content
                    if (detectedATS == null)
                    {
                        try
                        {
                            var response = await _httpClient.GetAsync(request.CareersUrl);
                            if (response.IsSuccessStatusCode)
                            {
                                var html = await response.Content.ReadAsStringAsync();
                                
                                // Check for ATS vendor patterns in HTML
                                foreach (var (pattern, vendor) in ATSPatterns)
                                {
                                    if (html.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                                    {
                                        detectedATS = vendor;
                                        detectionMethod = "Page content analysis";
                                        break;
                                    }
                                }

                                // Check for common meta tags
                                if (detectedATS == null)
                                {
                                    if (html.Contains("greenhouse", StringComparison.OrdinalIgnoreCase))
                                    {
                                        detectedATS = "Greenhouse";
                                        detectionMethod = "Page content analysis";
                                    }
                                    else if (html.Contains("lever", StringComparison.OrdinalIgnoreCase))
                                    {
                                        detectedATS = "Lever";
                                        detectionMethod = "Page content analysis";
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not fetch careers page");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Invalid URL provided");
                }
            }

            var knownAIScreeningVendors = new[]
            {
                "HireVue",
                "Pymetrics",
                "Modern Hire",
                "Hiretual",
                "Eightfold.ai",
                "Paradox.ai",
                "Phenom"
            };

            return Ok(new
            {
                CompanyName = request.CompanyName,
                CareersUrl = request.CareersUrl,
                ATSDetected = detectedATS != null,
                ATSVendor = detectedATS,
                DetectionMethod = detectionMethod,
                LikelyUsesAI = detectedATS != null, // Most modern ATS systems have AI features
                Disclaimer = "Detection shows the Applicant Tracking System (ATS) in use. Most modern ATS platforms include AI-powered resume screening, but specific AI usage varies by company configuration and cannot be definitively determined from public data.",
                KnownAIVendors = knownAIScreeningVendors,
                Recommendation = detectedATS != null 
                    ? $"This company uses {detectedATS}. Optimize your resume with relevant keywords from the job description."
                    : "Could not detect ATS system. Follow standard best practices for resume submission."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking job screening");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    public record JobCheckRequest
    {
        public string CompanyName { get; set; } = "";
        public string? CareersUrl { get; set; }
    }
}
