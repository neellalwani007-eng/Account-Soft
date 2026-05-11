@echo off
setlocal enabledelayedexpansion
title Push AccountSoft to GitHub
cls

echo.
echo  ============================================
echo   AccountSoft - Push to GitHub
echo  ============================================
echo.
echo  This will upload your project to GitHub
echo  so the cloud build can make your .exe file.
echo.

set "APP=%~dp0"
if "!APP:~-1!"=="\" set "APP=!APP:~0,-1!"
set "APP=!APP:\.."
cd /d "!APP:\.."
for /f "delims=" %%i in ('cd') do set "APP=%%i"

echo  Project folder: !APP!
echo.

REM Check git
where git >nul 2>&1
if errorlevel 1 (
    echo  Git is not installed.
    echo  Download from: https://git-scm.com/download/win
    echo  Install it, then run this script again.
    pause & exit /b 1
)
echo  Git found. OK.

echo.
echo  ============================================
echo   BEFORE CONTINUING:
echo.
echo   1. Go to https://github.com and sign in
echo      (create a free account if you don't have one)
echo.
echo   2. Click the + button (top right)
echo      and choose "New repository"
echo.
echo   3. Repository name: accountsoft
echo   4. Set it to PRIVATE
echo   5. Do NOT add README or .gitignore
echo   6. Click "Create repository"
echo.
echo   7. Copy the repository URL — it looks like:
echo      https://github.com/YOUR-USERNAME/accountsoft.git
echo.
echo  ============================================
echo.
set /p "REPO_URL=Paste your GitHub repository URL here: "

if "!REPO_URL!"=="" (
    echo  No URL entered. Exiting.
    pause & exit /b 1
)

echo.
echo  Setting up git in !APP!...
cd /d "!APP!"

git init -b main >nul 2>&1
git init >nul 2>&1

REM Check if remote already set
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "!REPO_URL!"
) else (
    git remote set-url origin "!REPO_URL!"
)
echo  Remote set to: !REPO_URL!

REM Create .gitignore to exclude heavy folders
if not exist ".gitignore" (
    (
        echo node_modules/
        echo electron-app/node_modules/
        echo electron-app/dist/
        echo electron-app/frontend/
        echo electron-app/src/server-bundle.cjs
        echo artifacts/account-soft/dist/
        echo artifacts/api-server/dist/
        echo .local/
        echo *.db-shm
        echo *.db-wal
        echo attached_assets/
    ) > .gitignore
    echo  .gitignore created.
)

echo.
echo  Adding all files to git...
git add .
git add -f artifacts/data/accountsoft.db 2>nul

echo  Creating commit...
git commit -m "AccountSoft - ready for Windows build" >nul 2>&1
if errorlevel 1 git commit --allow-empty -m "AccountSoft - ready for Windows build"

echo  Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
    echo.
    echo  Push failed. If asked to sign in, use your GitHub credentials.
    echo  OR try this: git push -u origin master
    git push -u origin master
    if errorlevel 1 ( echo  ERROR: Push failed. & pause & exit /b 1 )
)

echo.
echo  ============================================
echo   UPLOADED! Now go build your .exe:
echo.
echo   1. Open: !REPO_URL!
echo      (paste this in your browser)
echo.
echo   2. Click the "Actions" tab
echo.
echo   3. Click "Build AccountSoft Windows Installer"
echo.
echo   4. Click "Run workflow" button (top right)
echo      then click the green "Run workflow" button
echo.
echo   5. Wait ~10 minutes for it to finish
echo.
echo   6. Click the finished run, scroll down to
echo      "Artifacts" and click to download your
echo      AccountSoft-Windows-Installer.zip
echo.
echo   7. Unzip it and run AccountSoft Setup 1.0.0.exe
echo  ============================================
echo.
pause
