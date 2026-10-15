@echo off
REM GlassTodo one-click starter (Windows). Double-click start.bat. No manual commands.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found.
  echo Install Node 18+ once from https://nodejs.org then re-run start.bat
  pause
  exit /b 1
)

echo == GlassTodo starting ==
if not exist "frontend\node_modules" (
  echo -- first run: installing frontend ^(one time^) --
  call npm --prefix frontend install --no-audit --no-fund
  if errorlevel 1 pause & exit /b 1
)
if not exist "backend\node_modules" (
  echo -- first run: installing backend ^(one time^) --
  call npm --prefix backend install --no-audit --no-fund
  if errorlevel 1 pause & exit /b 1
)
if not exist "frontend\dist" (
  echo -- first run: building app ^(one time^) --
  call npm --prefix frontend run build
  if errorlevel 1 pause & exit /b 1
)

if "%PORT%"=="" set PORT=4000
echo -- opening http://localhost:%PORT% (if busy, app picks the next free port - watch the message) --
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%"
node backend\server.js
pause
