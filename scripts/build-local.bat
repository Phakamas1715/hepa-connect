@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set GOMAXPROCS=2
cd /d "%ROOT%"
"%NODE%" node_modules\vite\bin\vite.js build
