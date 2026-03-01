# Troubleshooting Guide

Common issues and solutions for the Privacy Intelligence Tools application.

---

## 🔧 Build Issues

### Issue: Build fails with "SDK not found"
**Error**: `The current .NET SDK does not support targeting .NET 10.0`

**Solution**:
```bash
# Download and install .NET 10 SDK
# https://dotnet.microsoft.com/download/dotnet/10.0

# Verify installation
dotnet --version
# Should show 10.0.x
```

### Issue: npm install fails
**Error**: `ERESOLVE unable to resolve dependency tree`

**Solution**:
```bash
cd tools_website.client
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue: TypeScript compilation errors
**Error**: `Cannot find module 'react-router-dom'`

**Solution**:
```bash
cd tools_website.client
npm install react-router-dom @types/react-router-dom
```

---

## 🌐 Runtime Issues

### Issue: Port already in use
**Error**: `Address already in use`

**Solution (Windows)**:
```powershell
# Find process using port 5173
netstat -ano | findstr :5173
# Kill the process
taskkill /PID <PID> /F
```

**Solution (Linux/Mac)**:
```bash
# Find and kill process
lsof -ti:5173 | xargs kill -9
```

### Issue: Frontend can't connect to backend
**Error**: `Network Error` or `Failed to fetch`

**Solution**:
1. Check backend is running on correct port
2. Verify CORS is enabled in `Program.cs`
3. Check browser console for specific error
4. Try accessing API directly: `https://localhost:7xxx/api/RobocallCheck/check/5551234567`

**Fix CORS issues**:
```csharp
// In Program.cs, ensure this is present:
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// And this in the app configuration:
app.UseCors();
```

### Issue: API returns 404
**Error**: `404 Not Found` for API endpoints

**Solution**:
1. Check controller route: `[Route("api/[controller]")]`
2. Verify method has HTTP verb attribute: `[HttpPost]`, `[HttpGet]`
3. Check URL matches controller name: `/api/RobocallCheck/check/...`
4. Ensure `app.MapControllers()` is in `Program.cs`

---

## 🐛 External API Issues

### Issue: Common Crawl returns empty results
**Error**: No records found for valid URLs

**Solution**:
- Common Crawl only indexes some pages, not all
- Try a well-known site like `https://example.com`
- Check crawl index status: https://index.commoncrawl.org/

### Issue: FCC API slow or timeout
**Error**: Request timeout after 30 seconds

**Solution**:
```csharp
// Increase timeout in controller constructor
_httpClient.Timeout = TimeSpan.FromSeconds(60);
```

### Issue: openFDA returns 404
**Error**: `404 Not Found` for drug name

**Solution**:
- Use exact brand name, not generic name
- Check spelling (case-insensitive but must be correct)
- Try common drugs: "Tylenol", "Advil", "Lipitor"
- Check FDA API status: https://open.fda.gov/apis/status/

### Issue: NYC Open Data rate limit
**Error**: `429 Too Many Requests`

**Solution**:
- Limit requests to ~1000/day for unauthenticated
- Add delays between requests
- Cache results in Redis
- Register for API token: https://data.cityofnewyork.us/signup

---

## 🎨 UI/UX Issues

### Issue: Styles not loading
**Error**: Page looks unstyled

**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard reload (Ctrl+Shift+R)
3. Check browser console for CSS errors
4. Verify `App.css` and `index.css` exist

### Issue: Navigation not working
**Error**: Clicking links does nothing

**Solution**:
- Ensure React Router is installed: `npm install react-router-dom`
- Check `App.tsx` has `<BrowserRouter>` wrapper
- Verify routes are properly defined in `<Routes>`

### Issue: Results not displaying
**Error**: API call succeeds but nothing shows

**Solution**:
1. Check browser console for React errors
2. Verify state is being updated: `setResult(data)`
3. Ensure result variable is not null: `{result && <div>...`
4. Check TypeScript interfaces match API response

---

## 🐳 Docker Issues

### Issue: Docker build fails
**Error**: `failed to solve: failed to compute cache key`

**Solution**:
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t privacy-tools .
```

### Issue: Container exits immediately
**Error**: Container stops right after starting

**Solution**:
```bash
# Check logs
docker logs <container-id>

# Run interactively to see errors
docker run -it privacy-tools /bin/bash
```

### Issue: Can't access app in container
**Error**: `This site can't be reached`

**Solution**:
- Verify port mapping: `-p 8080:8080`
- Check container is running: `docker ps`
- Try accessing via container IP: `docker inspect <container-id>`

---

## ☁️ Deployment Issues

### Issue: Azure deployment fails
**Error**: `Deployment failed`

**Solution**:
1. Check build logs in Azure Portal
2. Verify .NET version: Must be 10.0
3. Check environment variables
4. Ensure `WEBSITE_RUN_FROM_PACKAGE=1` is set

### Issue: SSL certificate errors
**Error**: `NET::ERR_CERT_AUTHORITY_INVALID`

**Solution**:
- In development: Trust dev certificate
  ```bash
  dotnet dev-certs https --trust
  ```
- In production: Use proper SSL from Let's Encrypt or cloud provider

### Issue: Environment variables not working
**Error**: Configuration values not loading

**Solution**:
```bash
# Check appsettings.json
# For Azure, set in Configuration blade
# For Docker, use docker-compose.yml:
environment:
  - ASPNETCORE_ENVIRONMENT=Production
```

---

## 🔐 Security Issues

### Issue: HTTPS redirect loop
**Error**: Too many redirects

**Solution**:
```csharp
// Only redirect in non-development
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
```

### Issue: CORS blocking requests
**Error**: `blocked by CORS policy`

**Solution**:
```csharp
// Production CORS config
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://your-domain.com")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
```

---

## 📊 Performance Issues

### Issue: API calls very slow
**Error**: Requests take >10 seconds

**Solution**:
1. Check external API status pages
2. Implement caching:
   ```csharp
   builder.Services.AddMemoryCache();
   // Use IMemoryCache in controllers
   ```
3. Add response caching:
   ```csharp
   builder.Services.AddResponseCaching();
   app.UseResponseCaching();
   ```

### Issue: Frontend bundle too large
**Error**: Slow initial load

**Solution**:
```bash
# Optimize Vite build
cd tools_website.client
npm run build

# Check bundle size
ls -lh dist/assets/

# Enable compression in production
# Use CDN for static assets
```

---

## 🧪 Testing Issues

### Issue: Can't test API endpoints
**Error**: Need to manually test APIs

**Solution (Using cURL)**:
```bash
# Test robocall check
curl https://localhost:7xxx/api/RobocallCheck/check/5551234567

# Test AI content check
curl -X POST https://localhost:7xxx/api/AIContentCheck/check-url \
  -H "Content-Type: application/json" \
  -d '{"Url":"https://example.com"}'
```

**Solution (Using Postman)**:
1. Import API endpoints
2. Set base URL: `https://localhost:7xxx/api`
3. Test each endpoint individually

---

## 💾 Data Issues

### Issue: Results inconsistent
**Error**: Same input returns different results

**Explanation**: This is expected behavior for some tools:
- **AI Content**: Different crawls may have different data
- **Robocall**: New complaints added daily
- **Medication**: FDA updates weekly
- **Face Dataset**: Mock implementation returns random results

**Solution**: Add caching for consistency within a session

### Issue: No results for valid input
**Error**: API returns empty results

**Verification checklist**:
- [ ] Input format is correct
- [ ] External API is operational
- [ ] Data actually exists for that input
- [ ] Rate limits not exceeded
- [ ] Network connectivity is working

---

## 🔍 Debugging Tips

### Enable detailed logging
```csharp
// appsettings.Development.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Debug"
    }
  }
}
```

### Check browser console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red errors
4. Check Network tab for failed requests

### Use breakpoints
1. In Visual Studio: Click left margin to add breakpoint
2. Run in Debug mode (F5)
3. Step through code (F10/F11)

### Test API directly
```bash
# Health check (if implemented)
curl https://localhost:7xxx/health

# Test specific endpoint
curl https://localhost:7xxx/api/RobocallCheck/check/5551234567 -v
```

---

## 📞 Getting Help

### Check logs
```bash
# Backend logs
dotnet run --project tools_website.Server

# Docker logs
docker logs -f <container-name>

# Azure logs
az webapp log tail --name your-app --resource-group your-rg
```

### Common log locations
- **Development**: Console output
- **Docker**: `docker logs`
- **Azure**: App Service logs
- **Linux**: `/var/log/`

### Documentation
- README.md - Project overview
- QUICKSTART.md - Getting started
- DEPLOYMENT.md - Deployment guides
- API_DOCUMENTATION.md - API reference

### External resources
- [ASP.NET Core Docs](https://learn.microsoft.com/en-us/aspnet/core/)
- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)

---

## 🛠️ Quick Fixes

### Reset everything
```bash
# Clean .NET
dotnet clean
dotnet restore
dotnet build

# Clean npm
cd tools_website.client
rm -rf node_modules package-lock.json
npm install

# Clean Docker
docker system prune -a
docker-compose down -v
docker-compose up --build
```

### Restart services
```bash
# Kill all node processes
taskkill /F /IM node.exe

# Kill .NET processes
taskkill /F /IM dotnet.exe

# Restart Docker
docker restart <container-name>
```

### Clear caches
```bash
# .NET NuGet cache
dotnet nuget locals all --clear

# npm cache
npm cache clean --force

# Browser cache
# Ctrl+Shift+Delete (manual)
```

---

## 🆘 Still Having Issues?

1. **Check this guide again** - Most issues are covered
2. **Review error message** - Often contains the solution
3. **Check documentation** - README.md and other guides
4. **Test external APIs** - Visit their status pages
5. **Simplify** - Test with minimal example
6. **Google the error** - Stack Overflow has answers
7. **Check GitHub Issues** - See if others had same problem

---

## ✅ Verification Checklist

Before asking for help, verify:

- [ ] .NET 10 SDK installed
- [ ] Node.js 18+ installed
- [ ] All dependencies restored
- [ ] Build completes successfully
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Browser console shows no errors
- [ ] Network requests succeeding
- [ ] External APIs accessible
- [ ] Correct ports being used
- [ ] CORS configured properly
- [ ] Environment variables set

---

## 🎯 Prevention Tips

### Best practices to avoid issues:

1. **Keep dependencies updated**
   ```bash
   dotnet outdated
   npm outdated
   ```

2. **Use version control**
   ```bash
   git commit -am "Working version"
   ```

3. **Test after changes**
   ```bash
   dotnet build
   npm run build
   ```

4. **Monitor logs**
   - Watch for warnings
   - Fix errors immediately

5. **Document custom changes**
   - Add comments
   - Update README

---

Remember: Most issues have simple solutions. Start with the basics (restart, clean, rebuild) before diving deep.
