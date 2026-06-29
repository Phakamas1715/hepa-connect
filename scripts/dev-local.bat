@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
cd /d "%ROOT%"
"%NODE%" node_modules\vite\bin\vite.js dev --host 127.0.0.1 --port 5174
