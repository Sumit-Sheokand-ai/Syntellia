# Fix Vite Dependency Error

Write-Host "🔧 Fixing Vite dependency optimization error..." -ForegroundColor Cyan

# Stop any running processes
Write-Host "1. Stopping any running processes..." -ForegroundColor Yellow
Stop-Process -Name "node" -ErrorAction SilentlyContinue -Force
Stop-Process -Name "dotnet" -ErrorAction SilentlyContinue -Force
Start-Sleep -Seconds 2

# Clean Vite cache
Write-Host "2. Cleaning Vite cache..." -ForegroundColor Yellow
if (Test-Path ".vite") {
    Remove-Item -Recurse -Force .vite
    Write-Host "   ✓ Removed .vite cache" -ForegroundColor Green
}

# Clean node_modules/.vite
Write-Host "3. Cleaning node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules/.vite") {
    Remove-Item -Recurse -Force node_modules/.vite
    Write-Host "   ✓ Removed node_modules/.vite" -ForegroundColor Green
}

# Clean dist
Write-Host "4. Cleaning dist folder..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
    Write-Host "   ✓ Removed dist" -ForegroundColor Green
}

# Reinstall dependencies (optional - only if needed)
Write-Host "5. Reinstalling dependencies..." -ForegroundColor Yellow
npm install
Write-Host "   ✓ Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Now starting the server..." -ForegroundColor Cyan
Write-Host ""

# Start the server
dotnet run --project tools_website.Server.csproj
