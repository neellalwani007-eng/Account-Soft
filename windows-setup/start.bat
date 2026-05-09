@echo off
echo ===================================
echo  Starting AccountSoft
echo ===================================
echo.

cd /d "D:\Lite-Ledger"

echo Starting API Server (database backend)...
start "AccountSoft - API Server" cmd /k "cd /d D:\Lite-Ledger\artifacts\api-server && set NODE_ENV=development && node --enable-source-maps ./dist/index.mjs"

echo Waiting for API server to start...
timeout /t 4 /nobreak >nul

echo Starting Frontend (web interface)...
start "AccountSoft - Frontend" cmd /k "cd /d D:\Lite-Ledger && pnpm --filter @workspace/account-soft run dev"

echo.
echo ===================================
echo  AccountSoft is starting!
echo.
echo  Open your browser and go to:
echo  http://localhost:25833
echo ===================================
echo.
echo You can close this window.
pause
