@echo off
title Clove AI Installer & Runner
echo ===================================================
echo   🧠 CLOVE AI - AUTOMATED BOOTSTRAPPER & RUNNER
echo ===================================================
echo.

:: 1. Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed on this system!
    echo Clove AI requires Python 3.10 or higher to run.
    echo.
    echo Opening the Python download page in your web browser...
    start "" "https://www.python.org/downloads/"
    echo.
    echo Please install Python, make sure to check the box:
    echo "[x] Add Python.exe to PATH" during setup, then rerun Clove.
    echo.
    pause
    exit /b
)

:: 2. Check if pip is available, bootstrap if missing
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] pip is missing! Attempting to bootstrap pip...
    python -m ensurepip --default-pip >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to auto-install pip. Please install pip or reinstall Python.
        pause
        exit /b
    )
)

:: 3. Self-heal dependencies: install missing packages automatically
echo [1/3] Checking and installing required Python libraries...
echo       (This only installs missing packages on first run and is fast)
python -m pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Some advanced system libraries failed to install.
    echo Attempting safe fallback installation for core features...
    python -m pip install flask flask-socketio google-genai pillow python-dotenv supabase >nul 2>&1
)

:: 4. Open Clove AI interface in default browser
echo.
echo [2/3] Opening Clove AI Interface in your web browser...
timeout /t 2 /nobreak > nul
start "" "http://127.0.0.1:5000"

:: 5. Start Flask/Socket.IO Server
echo.
echo [3/3] Starting Clove AI Backend Server...
echo.
python app.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Clove AI failed to start.
    echo If issues persist, try running: pip install -r requirements.txt
    echo.
    pause
)
