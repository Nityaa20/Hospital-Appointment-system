@echo off
title MediFlow - Hospital System
color 0A

echo ============================================
echo    MediFlow - Smart Hospital System
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

cd /d "%~dp0backend"

:: Install dependencies
echo [1/3] Installing dependencies...
pip install flask flask-cors flask-jwt-extended bcrypt --quiet

:: Init DB
echo [2/3] Initializing database...
python database.py

:: Start server
echo [3/3] Starting MediFlow server...
echo.
echo ============================================
echo  Server running at: http://localhost:5000
echo  Open your browser to: http://localhost:5000
echo ============================================
echo.
echo Demo Credentials:
echo   Patient   : patient1 / 1234
echo   Doctor    : sharma / 1234  (or any doctor username)
echo   Reception : reception / 1234
echo.
echo Press Ctrl+C to stop the server.
echo.

start "" http://localhost:5000
python app.py

pause
