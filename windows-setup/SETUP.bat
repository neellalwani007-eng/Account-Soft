@echo off
setlocal enabledelayedexpansion

title AccountSoft - One-Click Setup

cls
echo.
echo  ==========================================
echo   AccountSoft - One-Click Windows Setup
echo  ==========================================
echo.

REM ---- Get the folder where this .bat file lives ----
set "APP=%~dp0"
if "!APP:~-1!"=="\" set "APP=!APP:~0,-1!"
cd /d "!APP!"

REM ---- Make sure npm global bin folder is in PATH ----
for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
if defined NPM_PREFIX set "PATH=!PATH!;!NPM_PREFIX!"

REM ======================================================
REM  Step 1: Check Node.js
REM ======================================================
echo  [1/7] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js is NOT installed.
    echo  Download from: https://nodejs.org  (choose LTS version)
    echo  Install it, then run SETUP.bat again.
    echo.
    pause & exit /b 1
)
for /f "delims=" %%i in ('node --version 2^>nul') do set "NODE_VER=%%i"
echo         Node.js !NODE_VER! found.

REM ======================================================
REM  Step 2: Check / Install pnpm
REM ======================================================
echo  [2/7] Checking pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo         pnpm not found. Installing...
    call npm install -g pnpm
    if errorlevel 1 (
        echo  ERROR: Could not install pnpm.
        pause & exit /b 1
    )
    for /f "delims=" %%i in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%i"
    set "PATH=!PATH!;!NPM_PREFIX!"
)
for /f "delims=" %%i in ('pnpm --version 2^>nul') do set "PNPM_VER=%%i"
echo         pnpm !PNPM_VER! found.

REM ======================================================
REM  Step 3: Fix Windows compatibility
REM ======================================================
echo  [3/7] Fixing Windows compatibility...

REM 3a - Remove Linux-only preinstall AND approve build scripts for pnpm 10/11
powershell -NoProfile -Command "$f='!APP!\package.json'; $j=Get-Content $f -Raw|ConvertFrom-Json; $j.scripts.PSObject.Properties.Remove('preinstall'); $builds=@('better-sqlite3','esbuild','msw','unrs-resolver','@swc/core'); $pnpmCfg=[PSCustomObject]@{onlyBuiltDependencies=$builds}; if(-not($j.PSObject.Properties['pnpm'])){$j|Add-Member -NotePropertyName 'pnpm' -NotePropertyValue $pnpmCfg}else{$j.pnpm=($j.pnpm|Add-Member -NotePropertyName 'onlyBuiltDependencies' -NotePropertyValue $builds -Force -PassThru)}; $j|ConvertTo-Json -Depth 20|Set-Content $f -Encoding UTF8"
echo         root package.json fixed.

REM 3b - Fix api-server dev script (export does not work on Windows)
powershell -NoProfile -Command "$f='!APP!\artifacts\api-server\package.json'; $j=Get-Content $f -Raw|ConvertFrom-Json; $j.scripts.dev='pnpm run build && pnpm run start'; $j|ConvertTo-Json -Depth 20|Set-Content $f -Encoding UTF8"
echo         api-server package.json fixed.

REM 3c - Remove ALL win32 exclusions (esbuild, rollup, and others)
powershell -NoProfile -Command "$f='!APP!\pnpm-workspace.yaml'; $lines=(Get-Content $f)|Where-Object{$_ -notmatch 'win32'}; Set-Content $f $lines -Encoding UTF8"
echo         pnpm-workspace.yaml fixed (all Windows binaries enabled).

REM ======================================================
REM  Step 4: Clean old node_modules and reinstall fresh
REM ======================================================
echo.
echo  [4/7] Removing old installation (ensures clean Windows install)...
if exist "!APP!\node_modules" (
    echo         Deleting node_modules folder, please wait...
    rmdir /s /q "!APP!\node_modules"
    echo         Old installation removed.
) else (
    echo         No previous installation found, skipping.
)

REM ======================================================
REM  Step 5: Install all dependencies
REM ======================================================
echo.
echo  [5/7] Installing dependencies...
echo         ^(This takes 5-10 minutes, please wait^)
echo.
call pnpm install
if errorlevel 1 (
    echo  Approving build scripts and retrying...
    call pnpm approve-builds --all >nul 2>&1
    call pnpm install
    if errorlevel 1 (
        echo  ERROR: Installation failed.
        pause & exit /b 1
    )
)
echo         All dependencies installed.

REM ======================================================
REM  Step 6: Build the API server
REM ======================================================
echo.
echo  [6/7] Building the application...
cd /d "!APP!\artifacts\api-server"
set "NODE_ENV=development"
call pnpm run build
if errorlevel 1 (
    echo  ERROR: Build failed.
    pause & exit /b 1
)
cd /d "!APP!"
echo         Build complete.

REM ======================================================
REM  Step 7: Create launcher + desktop shortcut
REM ======================================================
echo.
echo  [7/7] Creating desktop shortcut...

REM Write the improved start-accountsoft.bat launcher
set "LAUNCHER=!APP!\start-accountsoft.bat"
(
    echo @echo off
    echo setlocal enabledelayedexpansion
    echo title AccountSoft Launcher
    echo cls
    echo.
    echo for /f "delims=" %%%%i in ^('npm config get prefix 2^>nul'^) do set "NPM_PREFIX=%%%%i"
    echo if defined NPM_PREFIX set "PATH=%%PATH%%;%%NPM_PREFIX%%"
    echo.
    echo set "APP=!APP!"
    echo.
    echo echo.
    echo echo  ==========================================
    echo echo   AccountSoft is starting...
    echo echo  ==========================================
    echo echo.
    echo.
    echo echo  [1/3] Starting database server ^(port 8080^)...
    echo start "AccountSoft - API Server" cmd /k "set PORT=8080^&^& set NODE_ENV=development^&^& cd /d !APP!\artifacts\api-server^&^& echo API server starting...^&^& node --enable-source-maps ./dist/index.mjs"
    echo timeout /t 6 /nobreak ^>nul
    echo.
    echo echo  [2/3] Starting web interface ^(port 25833^)...
    echo start "AccountSoft - Web Interface" cmd /k "set PORT=25833^&^& set BASE_PATH=/^&^& cd /d !APP!^&^& echo Frontend starting, please wait...^&^& pnpm --filter @workspace/account-soft run dev"
    echo.
    echo echo.
    echo echo  [3/3] Waiting for app to be ready...
    echo echo         ^(First launch can take up to 60 seconds^)
    echo echo.
    echo.
    echo set ATTEMPTS=0
    echo :check_ready
    echo set /a ATTEMPTS+=1
    echo if %%ATTEMPTS%% gtr 40 ^(
    echo     echo  Timed out. Check the server windows for errors.
    echo     pause
    echo     exit /b 1
    echo ^)
    echo timeout /t 3 /nobreak ^>nul
    echo curl -s --max-time 2 http://localhost:25833 ^>nul 2^>^&1
    echo if errorlevel 1 ^(
    echo     echo         Still loading... ^[%%ATTEMPTS%%/40^]
    echo     goto check_ready
    echo ^)
    echo.
    echo echo.
    echo echo  ==========================================
    echo echo   AccountSoft is READY^^! Opening browser...
    echo echo  ==========================================
    echo echo.
    echo start http://localhost:25833
    echo echo  Keep the two server windows open while using the app.
    echo echo.
    echo pause
) > "!LAUNCHER!"

REM Copy the logo icon if available
set "ICON=!APP!\accountsoft.ico"
if not exist "!ICON!" (
    if exist "!APP!\windows-setup\accountsoft.ico" copy "!APP!\windows-setup\accountsoft.ico" "!ICON!" >nul
)

REM Create Windows desktop shortcut
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\AccountSoft.lnk'); $sc.TargetPath='!LAUNCHER!'; $sc.WorkingDirectory='!APP!'; $sc.Description='Launch AccountSoft Accounting App'; $sc.WindowStyle=7; $ico='!ICON!'; if(Test-Path $ico){$sc.IconLocation=$ico}; $sc.Save()"
echo         Desktop shortcut created.

REM ======================================================
REM  Done!
REM ======================================================
echo.
echo  ==========================================
echo   SETUP COMPLETE!
echo.
echo   An "AccountSoft" shortcut has been added
echo   to your Desktop.
echo.
echo   Double-click it anytime to launch the app.
echo   It will open your browser automatically at:
echo       http://localhost:25833
echo  ==========================================
echo.
pause
