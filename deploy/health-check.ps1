param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
$routes = @(
  "/",
  "/patients",
  "/integration",
  "/ili-report",
  "/api/connection-status",
  "/api/production-automation"
)

foreach ($route in $routes) {
  $url = "$BaseUrl$route"
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    Write-Host "$route => $($res.StatusCode)"
  } catch {
    Write-Host "$route => ERROR $($_.Exception.Message)"
  }
}

try {
  $ready = Invoke-RestMethod -Uri "$BaseUrl/api/production-automation" -TimeoutSec 30
  Write-Host "readiness=$($ready.readiness) canRunProduction=$($ready.canRunProduction) mode=$($ready.mode)"
  $ready.gates | ForEach-Object {
    Write-Host "$($_.id): $($_.state) - $($_.detail)"
  }
} catch {
  Write-Host "production readiness check failed: $($_.Exception.Message)"
}
