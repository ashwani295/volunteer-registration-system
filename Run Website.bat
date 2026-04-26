@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "SITE_URL=http://localhost:3001"

title VolunteerHub Launcher
echo Starting VolunteerHub...
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\node_modules" (
  echo Backend dependencies are missing.
  echo Run: cd backend ^&^& npm install
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
  echo Frontend dependencies are missing.
  echo Run: cd frontend ^&^& npm install
  pause
  exit /b 1
)

if exist "%FRONTEND_DIR%\node_modules\typescript\bin\tsc" (
  echo Building frontend JavaScript...
  pushd "%FRONTEND_DIR%"
  node.exe ".\node_modules\typescript\bin\tsc"
  if errorlevel 1 (
    popd
    echo Frontend build failed.
    pause
    exit /b 1
  )
  popd
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$backend = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; if (-not $backend) { Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory '%BACKEND_DIR%' -WindowStyle Hidden; }"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$frontend = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; if (-not $frontend) { Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory '%FRONTEND_DIR%' -WindowStyle Hidden; }"

echo Opening %SITE_URL% ...
start "" "%SITE_URL%"

echo.
echo VolunteerHub is running.
echo Website: %SITE_URL%
echo Backend: http://localhost:5000
echo.
echo You can close this window.
timeout /t 3 >nul
