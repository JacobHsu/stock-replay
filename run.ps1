# StockReplay - PowerShell Script
# Manage backend and frontend services

param(
    [Parameter(Position=0)]
    [ValidateSet('run', 'run-serverless', 'backend', 'serverless', 'frontend', 'stop', 'install', 'help')]
    [string]$Command = 'run'
)

function Show-Header {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  StockReplay" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Start-All {
    Show-Header
    Write-Host "🚀 Starting StockReplay..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "▶ Starting backend server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888"
    Start-Sleep -Seconds 3
    
    Write-Host "▶ Starting frontend server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
    Start-Sleep -Seconds 2
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ Services started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "🌐 Backend API:    http://localhost:8888" -ForegroundColor White
    Write-Host "🌐 Frontend App:   http://localhost:5173" -ForegroundColor White
    Write-Host "📚 API Docs:       http://localhost:8888/docs" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Close the PowerShell windows to stop services" -ForegroundColor Gray
    Write-Host ""
}

function Start-Backend {
    Write-Host "🔧 Starting backend server only..." -ForegroundColor Yellow
    Set-Location backend
    uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888
}

function Start-Serverless {
    Write-Host "⚡ Starting serverless backend only (port 8889)..." -ForegroundColor Yellow
    Set-Location serverless
    .venv\Scripts\uvicorn app:app --reload --port 8889
}

function Start-Frontend {
    Write-Host "🎨 Starting frontend server only..." -ForegroundColor Yellow
    Set-Location frontend
    npm run dev
}

function Stop-All {
    Show-Header
    Write-Host "🛑 Stopping StockReplay services..." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Killing backend (port 8888)..." -ForegroundColor Yellow
    $backend = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
    if ($backend) {
        Stop-Process -Id $backend.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Backend stopped" -ForegroundColor Green
    } else {
        Write-Host "✓ No backend process found" -ForegroundColor Gray
    }
    
    Write-Host "Killing frontend (port 5173)..." -ForegroundColor Yellow
    $frontend = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($frontend) {
        Stop-Process -Id $frontend.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Frontend stopped" -ForegroundColor Green
    } else {
        Write-Host "✓ No frontend process found" -ForegroundColor Gray
    }
    
    Write-Host "Cleaning up background processes..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -like "*uvicorn*" -or $_.ProcessName -like "*node*"} | Where-Object {$_.CommandLine -like "*app.main:app*" -or $_.CommandLine -like "*vite*"} | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ All services stopped" -ForegroundColor Green
    Write-Host ""
}

function Install-Dependencies {
    Show-Header
    Write-Host "📦 Installing dependencies..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "▶ Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    uv sync
    Set-Location ..
    
    Write-Host "▶ Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ All dependencies installed!" -ForegroundColor Green
    Write-Host ""
}

function Show-Help {
    Show-Header
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Available Commands" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ".\run.ps1 run       - Start both backend and frontend" -ForegroundColor White
    Write-Host ".\run.ps1 backend      - Start backend only (port 8888)" -ForegroundColor White
    Write-Host ".\run.ps1 serverless   - Start serverless backend only (port 8889)" -ForegroundColor White
    Write-Host ".\run.ps1 frontend     - Start frontend only" -ForegroundColor White
    Write-Host ".\run.ps1 stop      - Stop all services" -ForegroundColor White
    Write-Host ".\run.ps1 install   - Install all dependencies" -ForegroundColor White
    Write-Host ".\run.ps1 help      - Show this help message" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

# Main execution
switch ($Command) {
    'run'      { Start-All }
    'backend'    { Start-Backend }
    'serverless' { Start-Serverless }
    'frontend' { Start-Frontend }
    'stop'     { Stop-All }
    'install'  { Install-Dependencies }
    'help'     { Show-Help }
}
