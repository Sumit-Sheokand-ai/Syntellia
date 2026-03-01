using Microsoft.AspNetCore.Mvc;
using tools_website.Server.Attributes;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserDataController : ControllerBase
{
    private readonly ILogger<UserDataController> _logger;

    public UserDataController(ILogger<UserDataController> logger)
    {
        _logger = logger;
    }

    // Example of a protected endpoint that requires authentication
    [HttpGet("saved-searches")]
    [SupabaseAuth]
    public IActionResult GetSavedSearches()
    {
        // Get user ID from token (you'll need to parse the JWT)
        // For now, return sample data
        
        var savedSearches = new[]
        {
            new
            {
                Id = 1,
                Tool = "AI Content Check",
                Query = "https://example.com",
                Date = DateTime.UtcNow.AddDays(-5),
                Result = "Found in 3 crawls"
            },
            new
            {
                Id = 2,
                Tool = "Robocall Check",
                Query = "5551234567",
                Date = DateTime.UtcNow.AddDays(-2),
                Result = "23 complaints"
            }
        };

        return Ok(savedSearches);
    }

    [HttpPost("save-search")]
    [SupabaseAuth]
    public IActionResult SaveSearch([FromBody] SaveSearchRequest request)
    {
        // In a real app, save to database with user ID from JWT
        
        return Ok(new
        {
            Success = true,
            Message = "Search saved successfully",
            Id = new Random().Next(1000, 9999)
        });
    }

    [HttpDelete("saved-searches/{id}")]
    [SupabaseAuth]
    public IActionResult DeleteSavedSearch(int id)
    {
        // In a real app, delete from database
        
        return Ok(new
        {
            Success = true,
            Message = "Search deleted successfully"
        });
    }

    public record SaveSearchRequest
    {
        public string Tool { get; set; } = "";
        public string Query { get; set; } = "";
        public string Result { get; set; } = "";
    }
}
