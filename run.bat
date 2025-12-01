@echo off
REM StockReplay - Windows Batch Script
REM Manage backend and frontend services

echo.
echo ========================================
echo   StockReplay
echo ========================================
echo.

if "%1"=="" goto run
if "%1"=="run" goto run
if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend
if "%1"=="stop" goto stop
if "%1"=="install" goto install
if "%1"=="help" goto help
goto help

:run
echo Starting StockReplay...
echo ========================================
echo Starting backend server...
start "Backend Server" cmd /k "cd backend && uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888"
timeout /t 3 /nobreak >nul
echo Starting frontend server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul
echo ========================================
echo Services started successfully!
echo ========================================
echo Backend API:    http://localhost:8888
echo Frontend App:   http://localhost:5173
echo API Docs:       http://localhost:8888/docs
echo ========================================
echo Close the terminal windows to stop services
echo.
goto end

:backend
echo Starting backend server only...
cd backend
uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888
goto end

:frontend
echo Starting frontend server only...
cd frontend
npm run dev
goto end

:stop
echo Stopping StockReplay services...
echo ========================================
echo Killing backend (port 8888)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8888 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo Killing frontend (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo ========================================
echo All services stopped
echo.
goto end

:install
echo Installing dependencies...
echo ========================================
echo Installing backend dependencies...
cd backend
call uv sync
cd ..
echo Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo ========================================
echo All dependencies installed!
echo.
goto end

:help
echo ========================================
echo   StockReplay - Commands
echo ========================================
echo run.bat run       - Start both backend and frontend
echo run.bat backend   - Start backend only
echo run.bat frontend  - Start frontend only
echo run.bat stop      - Stop all services
echo run.bat install   - Install all dependencies
echo run.bat help      - Show this help message
echo ========================================
echo.
goto end

:end
