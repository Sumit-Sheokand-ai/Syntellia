# Quick Start Script (No Supabase Setup Required)

Write-Host "🚀 Starting Privacy Intelligence Tools..." -ForegroundColor Cyan
Write-Host ""

# Navigate to server directory
Set-Location tools_website.Server

Write-Host "✨ All 6 privacy tools will work without any setup!" -ForegroundColor Green
Write-Host "📝 Authentication is optional and can be configured during deployment" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Opening: https://localhost:5173" -ForegroundColor Cyan
Write-Host ""

# Start the server
dotnet run
