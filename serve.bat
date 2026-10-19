@echo off
cd /d "%~dp0"
echo http://localhost:8123
python -m http.server 8123
