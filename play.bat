@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem Teacher/dev option: play.bat --questions-off enables turning questions off (menu + ?questions=off)
if /i "%~1"=="--questions-off" set VITE_ALLOW_QUESTIONS_OFF=1
call npm run build || (echo Build failed & pause & exit /b 1)
start "BrainRacer server" /min cmd /c "npx vite preview --port 4173 --strictPort"
timeout /t 3 /nobreak >nul
start "" msedge --kiosk http://localhost:4173 --edge-kiosk-type=fullscreen --no-first-run
