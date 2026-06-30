# ติดตั้ง Task Scheduler บนเครื่องโรงพยาบาล (Windows/Laragon)
# รันด้วย PowerShell (Admin):
#   powershell -ExecutionPolicy Bypass -File deploy\install-hospital-push-task.ps1
param(
  [string]$PhpPath = "C:\laragon\bin\php\php-8.3.12-Win32-vs16-x64\php.exe",
  [string]$ScriptPath = "C:\laragon\www\kumhos\kumhos_lab_api\hospital-push-to-vps.php",
  [string]$TaskName = "HEPA-Hospital-Push-To-VPS",
  [string]$Schedule = "Hourly"
)

if (-not (Test-Path $PhpPath)) {
  $PhpPath = (Get-Command php -ErrorAction SilentlyContinue).Source
}
if (-not $PhpPath) { throw "php not found" }

$action = New-ScheduledTaskAction -Execute $PhpPath -Argument $ScriptPath
$trigger = if ($Schedule -eq "Daily") {
  New-ScheduledTaskTrigger -Daily -At "08:00"
} else {
  New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours((Get-Date).Hour + 1) -RepetitionInterval (New-TimeSpan -Hours 1)
}
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Write-Host "Registered task: $TaskName"
Write-Host "Ensure env vars HEPA_VPS_SYNC_URL and HEPA_VPS_SYNC_TOKEN are set for SYSTEM or in script directory .env"