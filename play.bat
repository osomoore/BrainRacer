@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules call npm install
rem Launch options (all optional, any order):
rem   --round SEC      round length in seconds        (default 300 = 5 min)
rem   --every SEC      seconds of driving between question breaks (default 10)
rem   --music 0..1     music volume                   (default 0.6)
rem   --sfx 0..1       sound-effects volume           (default 0.8)
rem   --questions-off  teacher/dev option: allows turning questions off (menu + ?questions=off)
rem Example: play.bat --round 240 --every 12 --music 0.5 --sfx 0.7
rem They are passed to the game as URL params (?round=240&every=12&music=0.5&sfx=0.7).
set "QS="
:args
if "%~1"=="" goto argsdone
if /i "%~1"=="--questions-off" (set VITE_ALLOW_QUESTIONS_OFF=1& shift & goto args)
if /i "%~1"=="--round" (set "QS=%QS%&round=%~2"& shift & shift & goto args)
if /i "%~1"=="--every" (set "QS=%QS%&every=%~2"& shift & shift & goto args)
if /i "%~1"=="--music" (set "QS=%QS%&music=%~2"& shift & shift & goto args)
if /i "%~1"=="--sfx" (set "QS=%QS%&sfx=%~2"& shift & shift & goto args)
echo Unknown option %~1 (ignored)
shift
goto args
:argsdone
set "URL=http://localhost:4173/"
if defined QS set "URL=%URL%?%QS:~1%"
call npm run build || (echo Build failed & pause & exit /b 1)
start "BrainRacer server" /min cmd /c "npx vite preview --port 4173 --strictPort"
timeout /t 3 /nobreak >nul
start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run
