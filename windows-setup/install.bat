@echo off
echo ===================================
echo  AccountSoft - Windows Setup
echo ===================================
echo.

cd /d "D:\Lite-Ledger"

echo [1/4] Fixing Windows compatibility in package files...

node -e "
const fs = require('fs');

var root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete root.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(root, null, 2));
console.log('  - Fixed root package.json (removed Linux-only script)');

var api = JSON.parse(fs.readFileSync('artifacts/api-server/package.json', 'utf8'));
api.scripts.dev = 'pnpm run build && pnpm run start';
fs.writeFileSync('artifacts/api-server/package.json', JSON.stringify(api, null, 2));
console.log('  - Fixed api-server package.json (fixed startup command)');
"

echo [2/4] Fixing build tool config for Windows...

node -e "
const fs = require('fs');
var yaml = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
yaml = yaml.replace(/  \"esbuild>@esbuild\/win32[^\n]*\n/g, '');
fs.writeFileSync('pnpm-workspace.yaml', yaml);
console.log('  - Fixed pnpm-workspace.yaml (enabled Windows build tools)');
"

echo [3/4] Installing dependencies (this may take a few minutes)...
call pnpm install
if errorlevel 1 (
  echo.
  echo ERROR: Installation failed. See the error message above.
  pause
  exit /b 1
)

echo [4/4] Building API server...
cd artifacts\api-server
set NODE_ENV=development
call pnpm run build
if errorlevel 1 (
  echo.
  echo ERROR: Build failed. See the error message above.
  pause
  exit /b 1
)
cd ..\..

echo.
echo ===================================
echo  Setup complete!
echo  Run start.bat to launch the app.
echo ===================================
pause
