@echo off
title XingHaKu Russia P^&L Calculator
chcp 65001 >nul
color 0b

cd /d "%~dp0"

echo ====================================
echo   XingHaKu Russia P^&L Calculator
echo ====================================
echo.

if not exist ".env" (
  echo [INFO] .env not found, copying .env.example
  copy ".env.example" ".env" >nul
)

echo [1/4] Stopping old services on 8018 and 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":8018 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":5173 "') do taskkill /f /pid %%a >nul 2>&1

echo [2/4] Starting backend API on 8018...
start "PL Backend API" cmd /k "python -m uvicorn backend_api.main:app --host 127.0.0.1 --port 8018 --reload"

echo [3/4] Waiting for backend...
timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend on 5173...
start "PL Frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 4 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo Backend:  http://127.0.0.1:8018
echo Frontend: http://127.0.0.1:5173
echo Default login comes from .env ADMIN_USERNAME / ADMIN_PASSWORD
echo.
pause
