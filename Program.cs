using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(renderPort) && int.TryParse(renderPort, out var parsedRenderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{parsedRenderPort}");
}

var corsOrigins = GetAllowedCorsOrigins(builder.Configuration, builder.Environment);
var supabaseUrl = builder.Configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL") ?? string.Empty;
var supabaseAuthority = string.IsNullOrWhiteSpace(supabaseUrl)
    ? string.Empty
    : $"{supabaseUrl.TrimEnd('/')}/auth/v1";
var permitLimit = Math.Clamp(builder.Configuration.GetValue<int?>("Security:RateLimiting:PermitLimit") ?? 100, 10, 5000);
var windowSeconds = Math.Clamp(builder.Configuration.GetValue<int?>("Security:RateLimiting:WindowSeconds") ?? 60, 1, 3600);

// Add services to the container.
builder.Services.AddHttpClient("ExternalApis", httpClient =>
{
    httpClient.Timeout = TimeSpan.FromSeconds(20);
    httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Syntellia/1.0");
});
builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCors", policy =>
    {
        policy.AllowAnyMethod()
              .AllowAnyHeader();

        if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins);
        }
        else
        {
            // Same-origin requests still work; this blocks cross-origin traffic unless explicitly configured.
            policy.SetIsOriginAllowed(_ => false);
        }
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        if (!string.IsNullOrWhiteSpace(supabaseAuthority))
        {
            options.Authority = supabaseAuthority;
            options.RequireHttpsMetadata = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = supabaseAuthority,
                ValidateAudience = true,
                ValidAudience = "authenticated",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(2)
            };
        }
    });

builder.Services.AddAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("ApiPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
}

app.UseForwardedHeaders();
app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    context.Response.Headers["Cross-Origin-Resource-Policy"] = "same-site";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co;";

    await next();
});

app.UseDefaultFiles();
app.MapStaticAssets();

app.UseRateLimiter();
app.UseCors("AppCors");
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapControllers().RequireRateLimiting("ApiPolicy");
app.MapFallbackToFile("/index.html");

app.Run();

static string[] GetAllowedCorsOrigins(IConfiguration configuration, IHostEnvironment environment)
{
    var configuredOrigins = configuration.GetSection("Security:Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
    var envOrigins = Environment.GetEnvironmentVariable("APP_CORS_ALLOWED_ORIGINS");
    var allOrigins = new List<string>(configuredOrigins);

    if (!string.IsNullOrWhiteSpace(envOrigins))
    {
        allOrigins.AddRange(envOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }

    if (environment.IsDevelopment() && allOrigins.Count == 0)
    {
        allOrigins.AddRange(
        [
            "https://localhost:5173",
            "http://localhost:5173",
            "https://localhost:64278",
            "http://localhost:64278"
        ]);
    }

    return allOrigins
        .Select(NormalizeOrigin)
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    static string NormalizeOrigin(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return string.Empty;
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            return string.Empty;
        }

        return uri.IsDefaultPort
            ? $"{uri.Scheme}://{uri.Host}"
            : $"{uri.Scheme}://{uri.Host}:{uri.Port}";
    }
}
