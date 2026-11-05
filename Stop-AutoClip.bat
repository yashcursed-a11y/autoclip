@echo off
title AutoClip Studio - Stop Server
echo Stopping AutoClip server and any background render tasks...

:: Kill processes listening on port 4173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4173 ^| findstr LISTENING') do (
    taskkill /PID %%a /F /T >nul 2>&1
)

:: Terminate any active rendering child processes
taskkill /IM ffmpeg.exe /F /T >nul 2>&1
taskkill /IM yt-dlp.exe /F /T >nul 2>&1

echo [OK] AutoClip server stopped successfully.
timeout /t 2 >nul
exit /b 0
