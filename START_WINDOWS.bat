@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (python tools\serve.py) else (py -3 tools\serve.py)
pause
