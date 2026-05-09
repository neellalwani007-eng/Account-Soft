@echo off
setlocal enabledelayedexpansion
title AccountSoft - Building Desktop Installer
cls

echo.
echo  ============================================
echo   AccountSoft - Build Desktop Installer
echo  ============================================
echo.
echo  This will create a Windows installer (.exe)
echo  that runs on any PC without Node.js.
echo  Please wait - this takes about 5-10 minutes.
echo.

REM ---- Set APP to the parent folder (e.g. D:\Lite-Ledger) ----
set "ELECTRON=%~dp0"
if "!ELECTRON:~-1!"=="\" set "ELECTRON=!ELECTRON:~0,-1!"
cd /d "!ELECTRON!\.."
for /f "delims=" %%i in ('cd') do set "APP=%%i"

echo  Project   : !APP!
echo  ElectronApp: !ELECTRON!
echo.

REM ---- Add npm/pnpm global bin to PATH ----
for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
if defined NPM_PREFIX set "PATH=!PATH!;!NPM_PREFIX!"

REM ============================================================
REM  Step 1: Verify prerequisites
REM ============================================================
echo  [1/9] Checking Node.js and pnpm...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed.
    echo  Download from https://nodejs.org and re-run BUILD.bat.
    pause & exit /b 1
)
for /f "delims=" %%i in ('node --version') do set "NODE_VER=%%i"
echo         Node.js !NODE_VER! found.

where pnpm >nul 2>&1
if errorlevel 1 (
    echo         pnpm not found. Installing...
    call npm install -g pnpm
    for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
    set "PATH=!PATH!;!NPM_PREFIX!"
)
for /f "delims=" %%i in ('pnpm --version') do set "PNPM_VER=%%i"
echo         pnpm !PNPM_VER! found.

REM ============================================================
REM  Step 2: Fix Windows compatibility
REM ============================================================
echo.
echo  [2/9] Fixing Windows compatibility...

powershell -NoProfile -Command ^
  "$f='!APP!\package.json'; $j=Get-Content $f -Raw|ConvertFrom-Json; $j.scripts.PSObject.Properties.Remove('preinstall'); $builds=@('better-sqlite3','esbuild','msw','unrs-resolver','@swc/core'); $pnpmCfg=[PSCustomObject]@{onlyBuiltDependencies=$builds}; if(-not($j.PSObject.Properties['pnpm'])){$j|Add-Member -NotePropertyName 'pnpm' -NotePropertyValue $pnpmCfg}else{$j.pnpm=($j.pnpm|Add-Member -NotePropertyName 'onlyBuiltDependencies' -NotePropertyValue $builds -Force -PassThru)}; $j|ConvertTo-Json -Depth 20|Set-Content $f -Encoding UTF8"
echo         package.json fixed.

powershell -NoProfile -Command ^
  "$f='!APP!\pnpm-workspace.yaml'; $lines=(Get-Content $f)|Where-Object{$_ -notmatch 'win32'}; Set-Content $f $lines -Encoding UTF8"
echo         pnpm-workspace.yaml fixed (all Windows binaries enabled).

REM ============================================================
REM  Step 3: Clean + install workspace dependencies
REM ============================================================
echo.
echo  [3/9] Removing old node_modules...
if exist "!APP!\node_modules" (
    echo         Deleting node_modules, please wait...
    rmdir /s /q "!APP!\node_modules"
)
echo         Done.

echo.
echo  [4/9] Installing workspace dependencies...
echo         (This can take 5-10 minutes on first run)
echo.
cd /d "!APP!"
call pnpm install
if errorlevel 1 (
    call pnpm approve-builds --all >nul 2>&1
    call pnpm install
    if errorlevel 1 ( echo  ERROR: pnpm install failed. & pause & exit /b 1 )
)
echo.
echo         All workspace dependencies installed.

REM ============================================================
REM  Step 5: Build the React frontend (static build)
REM ============================================================
echo.
echo  [5/9] Building React frontend...
set "PORT=3000"
set "BASE_PATH=/"
set "NODE_ENV=production"
set "REPL_ID="
call pnpm --filter @workspace/account-soft run build
if errorlevel 1 ( echo  ERROR: Frontend build failed. & pause & exit /b 1 )
echo         Frontend built to artifacts\account-soft\dist\public\

REM ============================================================
REM  Step 6: Bundle Express server for Electron (single CJS file)
REM ============================================================
echo.
echo  [6/9] Bundling Express server for Electron...
node "!ELECTRON!\build-server-bundle.mjs"
if errorlevel 1 ( echo  ERROR: Server bundle failed. & pause & exit /b 1 )
echo         Server bundle created.

REM ============================================================
REM  Step 7: Prepare Electron app folder
REM ============================================================
echo.
echo  [7/9] Preparing Electron app files...

REM Copy built React frontend
if exist "!ELECTRON!\frontend" rmdir /s /q "!ELECTRON!\frontend"
xcopy /s /y /i "!APP!\artifacts\account-soft\dist\public" "!ELECTRON!\frontend\" >nul
echo         Frontend files copied.

REM Copy icon
if not exist "!ELECTRON!\assets" mkdir "!ELECTRON!\assets"
if exist "!APP!\windows-setup\accountsoft.ico" (
    copy /y "!APP!\windows-setup\accountsoft.ico" "!ELECTRON!\assets\accountsoft.ico" >nul
) else if exist "!APP!\accountsoft.ico" (
    copy /y "!APP!\accountsoft.ico" "!ELECTRON!\assets\accountsoft.ico" >nul
)
echo         Icon copied.

REM Copy existing database as seed (optional — app creates fresh DB if absent)
if not exist "!ELECTRON!\data" mkdir "!ELECTRON!\data"
if exist "!APP!\artifacts\data\accountsoft.db" (
    copy /y "!APP!\artifacts\data\accountsoft.db" "!ELECTRON!\data\accountsoft.db" >nul
    echo         Existing database included.
)

REM ============================================================
REM  Step 8: Install Electron deps and rebuild native modules
REM ============================================================
echo.
echo  [8/9] Installing Electron and rebuilding SQLite driver...
cd /d "!ELECTRON!"

call npm install
if errorlevel 1 ( echo  ERROR: npm install failed inside electron-app. & pause & exit /b 1 )
echo         Electron dependencies installed.

call npx --yes @electron/rebuild -m better-sqlite3
if errorlevel 1 (
    echo  WARNING: @electron/rebuild failed, trying electron-rebuild...
    call npx --yes electron-rebuild -m better-sqlite3
    if errorlevel 1 (
        echo  ERROR: Could not rebuild better-sqlite3 for Electron.
        echo  This is needed for the database to work inside the app.
        pause & exit /b 1
    )
)
echo         SQLite driver rebuilt for Electron.

REM ============================================================
REM  Step 9: Build the installer
REM ============================================================
echo.
echo  [9/9] Building Windows installer (.exe)...
echo         (This downloads Electron binaries on first build - may take a few minutes)
echo.
call npx --yes electron-builder --win --x64
if errorlevel 1 ( echo  ERROR: electron-builder failed. & pause & exit /b 1 )

echo.
echo  ============================================
echo   BUILD COMPLETE!
echo.
echo   Your installer is at:
echo   !ELECTRON!\dist\AccountSoft Setup 1.0.0.exe
echo.
echo   Share this .exe with anyone.
echo   They can install AccountSoft without
echo   needing Node.js or any other software.
echo  ============================================
echo.

REM Open dist folder so user can find the installer
explorer "!ELECTRON!\dist"

pause
