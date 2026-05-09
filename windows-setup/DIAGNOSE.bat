@echo off
setlocal enabledelayedexpansion
title AccountSoft Diagnostics
cls

echo.
echo  ==========================================
echo   AccountSoft - Diagnostics
echo  ==========================================
echo.

set "APP=%~dp0"
if "!APP:~-1!"=="\" set "APP=!APP:~0,-1!"
cd /d "!APP!"

for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
if defined NPM_PREFIX set "PATH=!PATH!;!NPM_PREFIX!"

echo  --- Environment ---
node --version
pnpm --version
echo  App folder: !APP!
echo.

echo  --- Checking pnpm-workspace.yaml for win32 blocks ---
findstr /i "win32" "!APP!\pnpm-workspace.yaml" >nul 2>&1
if errorlevel 1 (
    echo  OK - No win32 exclusions found in pnpm-workspace.yaml
) else (
    echo  PROBLEM - win32 exclusions still present:
    findstr /i "win32" "!APP!\pnpm-workspace.yaml"
    echo.
    echo  Fixing now...
    powershell -NoProfile -Command "$f='!APP!\pnpm-workspace.yaml'; $lines=(Get-Content $f)|Where-Object{$_ -notmatch 'win32'}; Set-Content $f $lines -Encoding UTF8"
    echo  Fixed! Please run SETUP.bat to reinstall cleanly.
    echo.
)

echo.
echo  --- Checking if rollup Windows binary exists ---
if exist "!APP!\node_modules\.pnpm\@rollup+rollup-win32-x64-msvc*" (
    echo  OK - rollup Windows binary present
) else (
    echo  PROBLEM - @rollup/rollup-win32-x64-msvc is NOT installed
    echo  This is why Vite fails. You must run SETUP.bat to fix it.
)

echo.
echo  --- Checking if API server is built ---
if exist "!APP!\artifacts\api-server\dist\index.mjs" (
    echo  OK - API server is built
) else (
    echo  PROBLEM - API server dist not found. Run SETUP.bat first.
)

echo.
echo  --- Testing API server (port 8080) ---
curl -s --max-time 3 http://localhost:8080/api/healthz
if errorlevel 1 (
    echo  API server not running or not responding on port 8080
) else (
    echo  API server is running
)

echo.
echo  --- Testing frontend (port 25833) ---
curl -s --max-time 3 http://localhost:25833 >nul 2>&1
if errorlevel 1 (
    echo  Frontend not running on port 25833
) else (
    echo  Frontend is running
)

echo.
echo  --- Trying to start frontend manually (watch for errors below) ---
echo      Press Ctrl+C at any time to cancel
echo.
cd /d "!APP!"
set PORT=25833
set BASE_PATH=/
pnpm --filter @workspace/account-soft run dev

echo.
pause
