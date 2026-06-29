param(
  [Parameter(Mandatory = $true)]
  [string]$PublicIp
)

$ip = $PublicIp.Trim()
if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
  throw "PublicIp must be IPv4, for example 1.2.3.4"
}

$domain = "hepa-namphong.$ip.sslip.io"
Write-Host "Temporary domain: $domain"
Write-Host "Deploy command:"
Write-Host "sudo PUBLIC_IP=$ip bash deploy/install-lightsail-vps.sh"
Write-Host "LINE Webhook URL:"
Write-Host "https://$domain/api/line-webhook"
Write-Host "LIFF Endpoint URL:"
Write-Host "https://$domain/line/link"
