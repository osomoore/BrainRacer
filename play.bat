@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build || (echo Build failed & pause & exit /b 1)
start "BrainRacer server" /min cmd /c "npx vite preview --port 4173 --strictPort"
timeout /t 3 /nobreak >nul
start "" msedge --kiosk http://localhost:4173 --edge-kiosk-type=fullscreen --no-first-run
