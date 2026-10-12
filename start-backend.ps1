# Starts the NestJS backend on :4000 and tunnels it via ngrok reserved domain
# so mobile dev builds (and any physical device) can reach the API.
#
# Usage (preferred): start-backend.bat   OR   double-click start-backend.bat
# Usage (PowerShell): powershell -NoProfile -ExecutionPolicy Bypass -File .\start-backend.ps1
# Note: plain ".\start-backend.ps1" may open Notepad if .ps1 is associated with an editor.
#
# ngrok auth token: set NGROK_AUTHTOKEN in backend/.env (loaded below), or run
# `ngrok config add-authtoken <token>` once.
param(
    [int]$Port = 4000,
    [string]$Domain = "countdown-rocket-hatred.ngrok-free.dev",
    [switch]$Watch
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Load NGROK_AUTHTOKEN from backend/.env so ngrok can authenticate (it reads
# this environment variable directly).
$envFile = Join-Path $root "backend\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
            $key = $Matches[1]
            $val = $Matches[2].Trim().Trim('"').Trim("'")
            if ($key -eq 'NGROK_AUTHTOKEN' -and $val -and $val -notlike '*placeholder*') {
                $env:NGROK_AUTHTOKEN = $val
                Write-Host "Loaded NGROK_AUTHTOKEN from backend/.env"
            }
        }
    }
}

$backendCmd = if ($Watch) { @("--dir", "backend", "start:dev") } else { @("--dir", "backend", "start") }
Write-Host "Starting backend on 0.0.0.0:$Port (pnpm $($backendCmd -join ' '))..."
Start-Process -FilePath "pnpm" -ArgumentList $backendCmd -WorkingDirectory $root -WindowStyle Minimized

Write-Host "Starting ngrok tunnel -> https://$Domain (local :$Port)..."
# ngrok free-tier reserved domain; auth token comes from NGROK_AUTHTOKEN / ngrok config.
# --url is the current flag (older agents used --domain, now deprecated).
ngrok http --url=https://$Domain $Port
