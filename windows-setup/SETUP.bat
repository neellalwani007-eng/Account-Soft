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
echo  [1/6] Checking Node.js...
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
echo  [2/6] Checking pnpm...
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
echo  [3/6] Fixing Windows compatibility...

REM 3a - Remove Linux-only preinstall AND approve build scripts for pnpm 10/11
powershell -NoProfile -Command "$f='!APP!\package.json'; $j=Get-Content $f -Raw|ConvertFrom-Json; $j.scripts.PSObject.Properties.Remove('preinstall'); $builds=@('better-sqlite3','esbuild','msw','unrs-resolver','@swc/core'); $pnpmCfg=[PSCustomObject]@{onlyBuiltDependencies=$builds}; if(-not($j.PSObject.Properties['pnpm'])){$j|Add-Member -NotePropertyName 'pnpm' -NotePropertyValue $pnpmCfg}else{$j.pnpm=($j.pnpm|Add-Member -NotePropertyName 'onlyBuiltDependencies' -NotePropertyValue $builds -Force -PassThru)}; $j|ConvertTo-Json -Depth 20|Set-Content $f -Encoding UTF8"
echo         root package.json fixed.

REM 3b - Fix api-server dev script (export does not work on Windows)
powershell -NoProfile -Command "$f='!APP!\artifacts\api-server\package.json'; $j=Get-Content $f -Raw|ConvertFrom-Json; $j.scripts.dev='pnpm run build && pnpm run start'; $j|ConvertTo-Json -Depth 20|Set-Content $f -Encoding UTF8"
echo         api-server package.json fixed.

REM 3c - Re-enable Windows esbuild binary
powershell -NoProfile -Command "$f='!APP!\pnpm-workspace.yaml'; $lines=(Get-Content $f)|Where-Object{$_ -notmatch 'esbuild.*win32'}; Set-Content $f $lines -Encoding UTF8"
echo         pnpm-workspace.yaml fixed.

REM ======================================================
REM  Step 4: Install all dependencies
REM ======================================================
echo.
echo  [4/6] Installing dependencies...
echo         ^(This takes 5-10 minutes on first run, please wait^)
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
REM  Step 5: Build the API server
REM ======================================================
echo.
echo  [5/6] Building the application...
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
REM  Step 6: Create launcher + desktop shortcut
REM ======================================================
echo.
echo  [6/6] Creating desktop shortcut...

REM Write start-accountsoft.bat with all required environment variables
set "LAUNCHER=!APP!\start-accountsoft.bat"
(
    echo @echo off
    echo title AccountSoft
    echo.
    echo REM Add pnpm to PATH
    echo for /f "delims=" %%%%i in ^('npm config get prefix 2^>nul'^) do set "NPM_PREFIX=%%%%i"
    echo if defined NPM_PREFIX set "PATH=%%PATH%%;%%NPM_PREFIX%%"
    echo.
    echo echo Starting AccountSoft, please wait...
    echo.
    echo REM Start API server ^(port 8080^)
    echo start "AccountSoft API" /min cmd /k "cd /d !APP!\artifacts\api-server ^&^& set PORT=8080 ^&^& set NODE_ENV=development ^&^& node --enable-source-maps ./dist/index.mjs"
    echo.
    echo REM Wait for API server to be ready
    echo timeout /t 5 /nobreak ^>nul
    echo.
    echo REM Start frontend ^(port 25833, base path /^)
    echo start "AccountSoft UI" /min cmd /k "cd /d !APP! ^&^& set PORT=25833 ^&^& set BASE_PATH=/ ^&^& pnpm --filter @workspace/account-soft run dev"
    echo.
    echo REM Wait for frontend to compile then open browser
    echo timeout /t 12 /nobreak ^>nul
    echo start http://localhost:25833
    echo exit
) > "!LAUNCHER!"

REM Copy the logo to a permanent location inside the app folder
set "ICON=!APP!\accountsoft.ico"
if not exist "!ICON!" (
    if exist "!APP!\windows-setup\accountsoft.ico" copy "!APP!\windows-setup\accountsoft.ico" "!ICON!" >nul
)

REM Create Windows desktop shortcut (with logo if available)
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
