@echo off
setlocal
set TARGET=C:\laragon\www\kumhos\kumhos_lab_api
set SCRIPT_DIR=%~dp0

echo == HEPA Hospital Push Installer ==
if not exist "%TARGET%" (
  echo Laragon path not found: %TARGET%
  echo Edit TARGET in this bat file if needed.
  pause
  exit /b 1
)

copy /Y "%SCRIPT_DIR%hospital-push-to-vps.php" "%TARGET%\"
copy /Y "%SCRIPT_DIR%hepa-push.env" "%TARGET%\"

for /f "delims=" %%P in ('where php 2^>nul') do set PHP=%%P & goto :found
if exist "C:\laragon\bin\php\php-8.3.12-Win32-vs16-x64\php.exe" set PHP=C:\laragon\bin\php\php-8.3.12-Win32-vs16-x64\php.exe
:found
if "%PHP%"=="" (
  echo php not found
  pause
  exit /b 1
)

echo Testing push...
"%PHP%" "%TARGET%\hospital-push-to-vps.php"
if errorlevel 1 (
  echo Push test failed - check bridge URL/token in hepa-push.env
  pause
  exit /b 1
)

schtasks /Create /TN "HEPA-Hospital-Push-To-VPS" /TR "\"%PHP%\" \"%TARGET%\hospital-push-to-vps.php\"" /SC HOURLY /RU SYSTEM /F
echo.
echo Done. Task HEPA-Hospital-Push-To-VPS runs hourly.
pause