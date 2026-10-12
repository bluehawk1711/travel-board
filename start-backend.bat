@echo off
rem Starts the NestJS backend + ngrok (wraps start-backend.ps1 so .ps1 is not opened in Notepad).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1" %*
if errorlevel 1 pause
