using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace tools_website.Server.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class SupabaseAuthAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var authHeader = context.HttpContext.Request.Headers["Authorization"].FirstOrDefault();

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();

        // In a production app, you would validate the JWT token here
        // For now, we'll just check if a token exists
        // You can use libraries like System.IdentityModel.Tokens.Jwt to validate

        if (string.IsNullOrEmpty(token))
        {
            context.Result = new UnauthorizedResult();
        }

        await Task.CompletedTask;
    }
}
