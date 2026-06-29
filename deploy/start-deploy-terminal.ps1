param(
  [string]$DefaultPublicIp = "",
  [string]$DefaultUser = "ubuntu"
)

$ErrorActionPreference = "Stop"

$installer = "C:\Users\Lenovo\Downloads\hepa-glue-complete-integration\hepa-connect\deploy\deploy-from-windows.ps1"
$zip = "C:\Users\Lenovo\Downloads\hepa-namphong-vps-lightsail-deploy.zip"

Write-Host "========================================"
Write-Host " HEPA Namphong VPS/Lightsail Deployment "
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path $installer)) {
  throw "Installer not found: $installer"
}

if (-not (Test-Path $zip)) {
  throw "Deploy zip not found: $zip"
}

$prompt = if ($DefaultPublicIp) { "Public IP [$DefaultPublicIp]" } else { "Public IP" }
$publicIp = Read-Host $prompt
if (-not $publicIp -and $DefaultPublicIp) {
  $publicIp = $DefaultPublicIp
}
if (-not $publicIp) {
  throw "Public IP is required"
}

$user = Read-Host "SSH username [$DefaultUser]"
if (-not $user) {
  $user = $DefaultUser
}

$keyPath = Read-Host "Path to .pem key, or press Enter if none"

$args = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $installer,
  "-Host", $publicIp,
  "-User", $user,
  "-PublicIp", $publicIp
)

if ($keyPath) {
  $args += @("-KeyPath", $keyPath)
}

Write-Host ""
Write-Host "Starting deploy to $publicIp ..."
Write-Host ""

& powershell @args

Write-Host ""
Write-Host "Done. If there is an error, copy the terminal text and send it back."
Read-Host "Press Enter to close"
