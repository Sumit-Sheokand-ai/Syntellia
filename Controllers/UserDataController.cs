using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using tools_website.Server.Attributes;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserDataController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<UserDataController> _logger;
    private readonly string _supabaseUrl;
    private readonly string _supabaseApiKey;

    public UserDataController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<UserDataController> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApis");
        _logger = logger;
        _supabaseUrl = (configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL") ?? string.Empty)
            .Trim()
            .TrimEnd('/');
        _supabaseApiKey =
            configuration["Supabase:PublishableKey"] ??
            Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY") ??
            Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY") ??
            Environment.GetEnvironmentVariable("VITE_SUPABASE_ANON_KEY") ??
            string.Empty;
    }

    [HttpGet("saved-searches")]
    [SupabaseAuth]
    public async Task<IActionResult> GetSavedSearches()
    {
        var userId = GetAuthenticatedUserId();
        if (userId is null)
        {
            return Unauthorized(new { Error = "Invalid authentication token." });
        }

        if (!TryGetAccessToken(out var accessToken))
        {
            return Unauthorized(new { Error = "Missing bearer token." });
        }

        if (!IsSupabaseConfigured(out var configError))
        {
            return StatusCode(500, new { Error = configError });
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{_supabaseUrl}/rest/v1/user_searches?select=id,tool,query,result,created_at&user_id=eq.{Uri.EscapeDataString(userId)}&order=created_at.desc");
            AttachSupabaseHeaders(request, accessToken);

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to fetch user searches from Supabase. StatusCode={StatusCode}, Response={Response}",
                    (int)response.StatusCode,
                    responseBody);

                return StatusCode((int)response.StatusCode, new { Error = "Failed to load saved searches." });
            }

            var rows = JsonSerializer.Deserialize<List<UserSearchRow>>(responseBody, JsonOptions) ?? [];
            var savedSearches = rows.Select(row => new SavedSearchDto
            {
                Id = row.Id,
                Tool = row.Tool,
                Query = row.Query,
                Result = row.Result ?? string.Empty,
                Date = row.CreatedAt.UtcDateTime
            }).ToList();

            return Ok(savedSearches);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading saved searches for user {UserId}", userId);
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    [HttpPost("save-search")]
    [SupabaseAuth]
    public async Task<IActionResult> SaveSearch([FromBody] SaveSearchRequest request)
    {
        if (request is null)
        {
            return BadRequest(new { Error = "Invalid request payload." });
        }

        var userId = GetAuthenticatedUserId();
        if (userId is null)
        {
            return Unauthorized(new { Error = "Invalid authentication token." });
        }

        if (!TryGetAccessToken(out var accessToken))
        {
            return Unauthorized(new { Error = "Missing bearer token." });
        }

        if (!IsSupabaseConfigured(out var configError))
        {
            return StatusCode(500, new { Error = configError });
        }

        var normalizedTool = request.Tool.Trim();
        var normalizedQuery = request.Query.Trim();
        var normalizedResult = request.Result.Trim();

        if (normalizedTool.Length is < 2 or > 100)
        {
            return BadRequest(new { Error = "Tool must be between 2 and 100 characters." });
        }

        if (normalizedQuery.Length is < 1 or > 1000)
        {
            return BadRequest(new { Error = "Query must be between 1 and 1000 characters." });
        }

        if (normalizedResult.Length > 4000)
        {
            return BadRequest(new { Error = "Result must be 4000 characters or fewer." });
        }

        try
        {
            var payload = JsonSerializer.Serialize(new[]
            {
                new UserSearchInsertDto
                {
                    UserId = userId,
                    Tool = normalizedTool,
                    Query = normalizedQuery,
                    Result = normalizedResult
                }
            });

            var requestMessage = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_supabaseUrl}/rest/v1/user_searches");
            AttachSupabaseHeaders(requestMessage, accessToken);
            requestMessage.Headers.TryAddWithoutValidation("Prefer", "return=representation");
            requestMessage.Content = new StringContent(payload, Encoding.UTF8);
            requestMessage.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            var response = await _httpClient.SendAsync(requestMessage);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to save user search to Supabase. StatusCode={StatusCode}, Response={Response}",
                    (int)response.StatusCode,
                    responseBody);

                return StatusCode((int)response.StatusCode, new { Error = "Failed to save search." });
            }

            var insertedRows = JsonSerializer.Deserialize<List<UserSearchRow>>(responseBody, JsonOptions) ?? [];
            var insertedRow = insertedRows.FirstOrDefault();
            if (insertedRow is null)
            {
                _logger.LogWarning("Supabase returned no inserted row for user {UserId}", userId);
                return StatusCode(500, new { Error = "Search save succeeded but no row was returned." });
            }

            return Ok(new
            {
                Success = true,
                Message = "Search saved successfully",
                Id = insertedRow.Id,
                Date = insertedRow.CreatedAt.UtcDateTime
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving search for user {UserId}", userId);
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    [HttpDelete("saved-searches/{id}")]
    [SupabaseAuth]
    public async Task<IActionResult> DeleteSavedSearch(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || !Guid.TryParse(id, out _))
        {
            return BadRequest(new { Error = "Invalid search ID." });
        }

        var userId = GetAuthenticatedUserId();
        if (userId is null)
        {
            return Unauthorized(new { Error = "Invalid authentication token." });
        }

        if (!TryGetAccessToken(out var accessToken))
        {
            return Unauthorized(new { Error = "Missing bearer token." });
        }

        if (!IsSupabaseConfigured(out var configError))
        {
            return StatusCode(500, new { Error = configError });
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Delete,
                $"{_supabaseUrl}/rest/v1/user_searches?id=eq.{Uri.EscapeDataString(id)}&user_id=eq.{Uri.EscapeDataString(userId)}");
            AttachSupabaseHeaders(request, accessToken);
            request.Headers.TryAddWithoutValidation("Prefer", "return=representation");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to delete user search from Supabase. StatusCode={StatusCode}, Response={Response}",
                    (int)response.StatusCode,
                    responseBody);

                return StatusCode((int)response.StatusCode, new { Error = "Failed to delete search." });
            }

            var deletedRows = JsonSerializer.Deserialize<List<UserSearchRow>>(responseBody, JsonOptions) ?? [];
            if (deletedRows.Count == 0)
            {
                return NotFound(new { Error = "Saved search not found." });
            }

            return Ok(new
            {
                Success = true,
                Message = "Search deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting search {SearchId} for user {UserId}", id, userId);
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    private bool IsSupabaseConfigured(out string error)
    {
        if (string.IsNullOrWhiteSpace(_supabaseUrl))
        {
            error = "Supabase URL is not configured on the server.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(_supabaseApiKey))
        {
            error = "Supabase publishable key is not configured on the server.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private string? GetAuthenticatedUserId()
    {
        return User.FindFirstValue("sub")?.Trim()
               ?? User.FindFirstValue(ClaimTypes.NameIdentifier)?.Trim();
    }

    private bool TryGetAccessToken(out string token)
    {
        token = string.Empty;

        if (!Request.Headers.TryGetValue("Authorization", out var authorizationHeader))
        {
            return false;
        }

        if (!AuthenticationHeaderValue.TryParse(authorizationHeader, out var authHeaderValue) ||
            !string.Equals(authHeaderValue.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(authHeaderValue.Parameter))
        {
            return false;
        }

        token = authHeaderValue.Parameter.Trim();
        return true;
    }

    private void AttachSupabaseHeaders(HttpRequestMessage request, string accessToken)
    {
        request.Headers.TryAddWithoutValidation("apikey", _supabaseApiKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    private sealed record SavedSearchDto
    {
        public string Id { get; init; } = string.Empty;
        public string Tool { get; init; } = string.Empty;
        public string Query { get; init; } = string.Empty;
        public string Result { get; init; } = string.Empty;
        public DateTime Date { get; init; }
    }

    private sealed record UserSearchInsertDto
    {
        [JsonPropertyName("user_id")]
        public string UserId { get; init; } = string.Empty;

        [JsonPropertyName("tool")]
        public string Tool { get; init; } = string.Empty;

        [JsonPropertyName("query")]
        public string Query { get; init; } = string.Empty;

        [JsonPropertyName("result")]
        public string Result { get; init; } = string.Empty;
    }

    private sealed record UserSearchRow
    {
        [JsonPropertyName("id")]
        public string Id { get; init; } = string.Empty;

        [JsonPropertyName("tool")]
        public string Tool { get; init; } = string.Empty;

        [JsonPropertyName("query")]
        public string Query { get; init; } = string.Empty;

        [JsonPropertyName("result")]
        public string? Result { get; init; }

        [JsonPropertyName("created_at")]
        public DateTimeOffset CreatedAt { get; init; }
    }

    public record SaveSearchRequest
    {
        public string Tool { get; set; } = "";
        public string Query { get; set; } = "";
        public string Result { get; set; } = "";
    }
}
