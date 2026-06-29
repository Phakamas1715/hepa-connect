param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Prompt
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$hermesScripts = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts"
$hermesNode = Join-Path $env:LOCALAPPDATA "hermes\node"
$hermesGit = Join-Path $env:LOCALAPPDATA "hermes\git\bin"
$hermesBin = Join-Path $env:LOCALAPPDATA "hermes\bin"

$env:Path = "$hermesScripts;$hermesNode;$hermesGit;$hermesBin;$env:Path"

if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
  Write-Host "Hermes command not found. Install Hermes first." -ForegroundColor Red
  exit 1
}

$systemContext = @"
You are helping the HEPA-GLUE x hepa-connect project for hepatitis B/C care cascade work.
Focus on local development, integration status, HOSxP/Smart Query/lab feed readiness,
LINE follow-up, and MOPH reporting. Do not send or request real patient identifiers,
national IDs, phone numbers, or other PHI. If production credentials or patient data
are needed, explain the missing requirement instead of inventing values.
"@

Push-Location $projectRoot
try {
  hermes --oneshot "$systemContext`n`nUser request: $Prompt"
} finally {
  Pop-Location
}
