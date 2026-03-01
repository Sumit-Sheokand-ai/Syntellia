using Microsoft.AspNetCore.Authorization;

namespace tools_website.Server.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public sealed class SupabaseAuthAttribute : AuthorizeAttribute
{
}
