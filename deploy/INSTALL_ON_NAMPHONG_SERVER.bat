@echo off
setlocal

set "SOURCE=%~dp0hepa_glue_hepatitis_proxy.php"
set "TARGET_DIR=C:\laragon\www\kumhos\kumhos_lab_api"
set "TARGET=%TARGET_DIR%\hepa_glue_hepatitis_proxy.php"

if not exist "%SOURCE%" (
  echo [ERROR] Missing %SOURCE%
  exit /b 1
)

if not exist "%TARGET_DIR%" (
  echo [ERROR] Target folder not found: %TARGET_DIR%
  echo Run this file on the Nam Phong server, or edit TARGET_DIR in this .bat.
  exit /b 1
)

copy /Y "%SOURCE%" "%TARGET%" >nul
if errorlevel 1 (
  echo [ERROR] Copy failed.
  exit /b 1
)

echo [OK] Installed HEPA HOSxP bridge:
echo %TARGET%
echo.
echo Test URL:
echo http://172.16.213.55/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php?action=status
endlocal
