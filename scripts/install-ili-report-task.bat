@echo off
setlocal

set TASK_NAME=HEPA-GLUE ILI D506 Report
set PROJECT_DIR=%~dp0..
set SCRIPT=%PROJECT_DIR%\scripts\ili-report-runner.ps1

schtasks /Create /F /TN "%TASK_NAME%" /SC WEEKLY /D MON,TUE /ST 08:30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\"" /RL LIMITED

echo Installed task: %TASK_NAME%
echo It will call /api/ili-report every Monday and Tuesday at 08:30.
endlocal
