$ErrorActionPreference = "Stop"

$hermesScripts = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts"
$hermesNode = Join-Path $env:LOCALAPPDATA "hermes\node"
$hermesGit = Join-Path $env:LOCALAPPDATA "hermes\git\bin"
$hermesBin = Join-Path $env:LOCALAPPDATA "hermes\bin"

$env:Path = "$hermesScripts;$hermesNode;$hermesGit;$hermesBin;$env:Path"

Write-Host "HEPA-GLUE x Hermes local status" -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot\.." -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
  Write-Host "Hermes command not found. Install Hermes first." -ForegroundColor Red
  exit 1
}

hermes version
Write-Host ""
hermes status
