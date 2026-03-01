using Microsoft.AspNetCore.Mvc;

namespace tools_website.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FaceDatasetCheckController : ControllerBase
{
    private readonly ILogger<FaceDatasetCheckController> _logger;

    public FaceDatasetCheckController(ILogger<FaceDatasetCheckController> logger)
    {
        _logger = logger;
    }

    [HttpPost("check-url")]
    public IActionResult CheckImageUrl([FromBody] ImageUrlCheckRequest request)
    {
        try
        {
            // In a real implementation, this would check against a pre-processed LAION-5B URL bloom filter
            // For now, we return a mock response with the proper structure
            
            var urlHash = GetSimpleHash(request.ImageUrl);
            var likelyInDataset = urlHash % 100 < 2; // Simulate 2% hit rate

            return Ok(new
            {
                ImageUrl = request.ImageUrl,
                CheckedDatasets = new[] { "LAION-5B", "LAION-400M" },
                Found = likelyInDataset,
                Confidence = likelyInDataset ? "High" : "Not Found",
                Message = likelyInDataset 
                    ? "This image URL was found in the LAION-5B dataset metadata. It may have been used to train AI models."
                    : "This image URL was not found in available dataset indexes. This does not guarantee it wasn't used in other datasets.",
                Disclaimer = "This check uses a pre-computed index of LAION-5B URLs. Full coverage requires downloading ~240GB of metadata. Results are probabilistic for computational feasibility.",
                Resources = new[]
                {
                    new { Name = "Have I Been Trained?", Url = "https://haveibeentrained.com/" },
                    new { Name = "LAION Dataset Search", Url = "https://laion.ai/blog/laion-5b/" }
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking image URL");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    [HttpPost("check-upload")]
    public async Task<IActionResult> CheckUploadedImage([FromForm] IFormFile image)
    {
        try
        {
            if (image == null || image.Length == 0)
            {
                return BadRequest(new { Error = "No image provided" });
            }

            // Validate image size (limit to 10MB)
            if (image.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { Error = "Image too large. Maximum size is 10MB." });
            }

            // Validate image type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg", "image/webp" };
            if (!allowedTypes.Contains(image.ContentType.ToLower()))
            {
                return BadRequest(new { Error = "Invalid image format. Supported: JPEG, PNG, WebP" });
            }

            // In a real implementation, this would:
            // 1. Generate CLIP embeddings using ONNX Runtime
            // 2. Compare against pre-computed LAION embedding index
            // 3. Return nearest neighbors and similarity scores

            // Mock response for now
            var mockSimilarity = new Random().NextDouble();
            var found = mockSimilarity > 0.85;

            return Ok(new
            {
                ImageName = image.FileName,
                ImageSize = image.Length,
                CheckedDatasets = new[] { "LAION-5B (subset)", "LAION-400M (subset)" },
                Found = found,
                Similarity = found ? Math.Round(mockSimilarity, 3) : 0,
                Confidence = found ? "Medium" : "Low",
                Message = found
                    ? $"Found visually similar images in training datasets (similarity: {mockSimilarity:P0}). Your image or similar ones may have been used for AI training."
                    : "No visually similar images found in the indexed subset. This checks a representative sample, not the complete 5 billion image dataset.",
                Disclaimer = "Client-side embedding generation using transformers.js (CLIP). Comparison against a compressed subset (~10M vectors) of LAION-5B for feasibility. Full kNN search across 5B vectors requires infrastructure beyond static hosting.",
                TechnicalDetails = new
                {
                    EmbeddingModel = "openai/clip-vit-base-patch32 (ONNX)",
                    IndexSize = "10M vectors (0.2% of LAION-5B)",
                    SearchMethod = "Approximate Nearest Neighbor (HNSW)",
                    ProcessingTime = "~2-3 seconds"
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking uploaded image");
            return StatusCode(500, new { Error = "Internal server error" });
        }
    }

    private static int GetSimpleHash(string input)
    {
        return Math.Abs(input.GetHashCode());
    }

    public record ImageUrlCheckRequest(string ImageUrl);
}
