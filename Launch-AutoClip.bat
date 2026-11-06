@echo off
title AUTOCLIPIN Pro Studio
cd /d "%~dp0"
echo Starting AUTOCLIPIN Desktop App...
if exist "%LOCALAPPDATA%\Programs\autoclip\AUTOCLIPIN.exe" (
  start "" "%LOCALAPPDATA%\Programs\autoclip\AUTOCLIPIN.exe"
  exit /b
)
call npx electron .
