@echo off
cd /d "%~dp0"
echo Starting Drawing App server...
echo.
echo Open this URL in your browser:
echo http://127.0.0.1:5173
echo.
python server.py
pause
