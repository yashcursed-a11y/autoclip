@echo off
setlocal enabledelayedexpansion
title AUTOCLIP Desktop Studio
cd /d "%~dp0"

echo ===================================================
echo               AUTOCLIP STUDIO
echo ===================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not on your system PATH.
    echo Please install Node.js from https://nodejs.org and re-run this launcher.
    echo.
    pause
    exit /b 1
)

:: 2. Verify dependencies
if not exist "node_modules\" (
    echo [INFO] First run detected. Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo [INFO] Starting AUTOCLIP local backend on http://localhost:4173 ...
echo [INFO] Server logs will appear below. Keep this window open while editing.
echo.

:: 3. Launch background monitor that waits until server is live, then opens regular desktop browser
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "for ($i = 0; $i -lt 60; $i++) { ^
     try { ^
       $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/api/system/status' -UseBasicParsing -TimeoutSec 1; ^
       if ($resp.StatusCode -eq 200) { ^
         Start-Process 'http://localhost:4173'; ^
         break; ^
       } ^
     } catch { ^
       Start-Sleep -Milliseconds 400; ^
     } ^
   }"

:: 4. Start Node.js server in the foreground
node server.js

echo.
echo ===================================================
echo  AUTOCLIP server has stopped.
echo ===================================================
pause
