param(
  [string]$BaseUrl = "http://127.0.0.1:5174",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$today = Get-Date
$isScheduledDay = $today.DayOfWeek -in @("Monday", "Tuesday")
if (-not $Force -and -not $isScheduledDay) {
  Write-Output "skip: ILI report runs only on Monday and Tuesday"
  exit 0
}

$uri = "$BaseUrl/api/ili-report"
$body = @{ submit = $true } | ConvertTo-Json -Compress
$response = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60

Write-Output ("ili_report_date={0}" -f $response.reportDate)
Write-Output ("ili_visits={0}" -f $response.iliVisits)
Write-Output ("total_visits={0}" -f $response.totalVisits)
Write-Output ("state={0}" -f $response.state)
Write-Output ("message={0}" -f $response.message)
