@echo off
setlocal enabledelayedexpansion
title AccountSoft Launcher
cls

REM Add npm/pnpm global directory to PATH
for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
if defined NPM_PREFIX set "PATH=!PATH!;!NPM_PREFIX!"

REM Set app directory to wherever this file lives
set "APP=%~dp0"
if "!APP:~-1!"=="\" set "APP=!APP:~0,-1!"

echo.
echo  ==========================================
echo   AccountSoft is starting...
echo  ==========================================
echo.

REM ---- Start the API server (visible window so you can see errors) ----
echo  [1/3] Starting database server (port 8080)...
start "AccountSoft - API Server" cmd /k "set PORT=8080&& set NODE_ENV=development&& cd /d !APP!\artifacts\api-server&& echo API server starting...&& node --enable-source-maps ./dist/index.mjs"

echo         Waiting for API server...
timeout /t 6 /nobreak >nul

REM ---- Start the Vite frontend (visible window so you can see errors) ----
echo  [2/3] Starting web interface (port 25833)...
start "AccountSoft - Web Interface" cmd /k "set PORT=25833&& set BASE_PATH=/&& cd /d !APP!&& echo Frontend starting, please wait...&& pnpm --filter @workspace/account-soft run dev"

REM ---- Poll until the frontend is actually ready ----
echo.
echo  [3/3] Waiting for app to be ready...
echo         (First launch can take up to 60 seconds, please wait)
echo.

set ATTEMPTS=0
:check_ready
set /a ATTEMPTS+=1
if !ATTEMPTS! gtr 40 (
    echo.
    echo  Timed out. Check the two server windows for errors.
    echo  Then try opening: http://localhost:25833
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul
curl -s --max-time 2 http://localhost:25833 >nul 2>&1
if errorlevel 1 (
    echo         Still loading... ^(!ATTEMPTS!/40^)
    goto check_ready
)

REM ---- App is ready ----
echo.
echo  ==========================================
echo   AccountSoft is READY!
echo   Opening your browser now...
echo  ==========================================
echo.
start http://localhost:25833

echo  The app is running at: http://localhost:25833
echo.
echo  Two server windows are running in the background.
echo  Leave them open while you use the app.
echo  To stop the app, close both server windows.
echo.
pause
