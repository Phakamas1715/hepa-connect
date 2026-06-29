param(
  [Parameter(Mandatory = $true)]
  [Alias("Host")]
  [string]$Server,

  [string]$User = "ubuntu",

  [string]$PublicIp = "",

  [string]$Domain = "",

  [string]$KeyPath = "",

  [string]$ZipPath = "C:\Users\Lenovo\Downloads\hepa-namphong-vps-lightsail-deploy.zip"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH Client not found. Install OpenSSH Client first."
}

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "scp not found. Install OpenSSH Client first."
}

if (-not (Test-Path $ZipPath)) {
  throw "Deploy zip not found: $ZipPath"
}

$sshTarget = "$User@$Server"
$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($KeyPath) {
  if (-not (Test-Path $KeyPath)) {
    throw "Key file not found: $KeyPath"
  }
  $sshArgs += @("-i", $KeyPath)
}

$remoteZip = "/tmp/hepa-namphong-vps-lightsail-deploy.zip"
$remoteDir = "/tmp/hepa-namphong-deploy"

Write-Host "== Uploading HEPA deploy package =="
& scp @sshArgs $ZipPath "${sshTarget}:$remoteZip"
if ($LASTEXITCODE -ne 0) {
  throw "Upload failed. Check SSH key/user/host."
}

$domainArg = ""
if ($Domain) {
  $domainArg = "DOMAIN=$Domain"
} elseif ($PublicIp) {
  $domainArg = "PUBLIC_IP=$PublicIp"
} else {
  $domainArg = "DOMAIN=hepa.namphonghospital.go.th"
}

$remoteScript = @"
set -e
sudo apt-get update
sudo apt-get install -y unzip
rm -rf $remoteDir
mkdir -p $remoteDir
unzip -o $remoteZip -d $remoteDir
cd $remoteDir
sudo $domainArg bash deploy/install-lightsail-vps.sh
"@

Write-Host "== Installing on VPS/Lightsail =="
& ssh @sshArgs $sshTarget $remoteScript
if ($LASTEXITCODE -ne 0) {
  throw "Remote install failed."
}

$finalDomain = $Domain
if (-not $finalDomain -and $PublicIp) {
  $finalDomain = "hepa-namphong.$PublicIp.sslip.io"
}
if (-not $finalDomain) {
  $finalDomain = "hepa.namphonghospital.go.th"
}

Write-Host ""
Write-Host "== Done =="
Write-Host "App URL: https://$finalDomain"
Write-Host "Health: https://$finalDomain/health"
Write-Host "Production readiness: https://$finalDomain/api/production-automation"
Write-Host "LINE Webhook URL: https://$finalDomain/api/line-webhook"
Write-Host "LIFF Endpoint URL: https://$finalDomain/line/link"
