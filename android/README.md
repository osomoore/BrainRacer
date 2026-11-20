# BrainRacer TV wrapper

A tiny Android TV app: one full-screen WebView that loads the live game
(`https://osomoore.github.io/BrainRacer/`). It exists so that **Back / gamepad B does nothing**:
B is a real in-game button (red answer / back), and some TV browsers (TV Bro) turn a held B
into controller-as-mouse mode. The wrapper passes all gamepad events to the page (Gamepad API)
and swallows Back/B at the Activity level only. It also swallows the gamepad Home/Guide button
when the controller sends it as `KEYCODE_BUTTON_MODE`. A real `KEYCODE_HOME`, from the remote or
from some controllers, goes to the system and can't be blocked by an app.

## Build

```powershell
.\android\build.ps1          # -> android\out\BrainRacerTV.apk
```

First run creates the release keystore `C:\Users\osomo\AndroidDev\brainracer-release.jks` and
`C:\Users\osomo\AndroidDev\brainracer-keystore.properties`. **Back both up.** If lost you must
uninstall the app to install an update signed with a new key, which wipes its saved settings.

## First-time ONN setup

1. Settings > System > About > tap "Android TV OS build" 7 times.
2. Developer options > USB debugging on.
3. On Android 11+ Google TV you may need Wireless debugging pairing:
   `adb pair ip:port code`, then `adb connect ip:port`. Otherwise `adb connect ip:5555`.

## Install

```powershell
.\android\build.ps1 -Install -Device 192.168.1.50:5555
```

## Point at a dev server

```powershell
adb shell am start -n com.osomoore.brainracer.tv/.MainActivity --es url http://192.168.1.50:5173/
adb shell am start -n com.osomoore.brainracer.tv/.MainActivity --es url default   # reset
```

The override is remembered until reset.

## Remote debugging

Open `chrome://inspect` in Edge/Chrome on the PC (adb connected) and inspect the WebView.

## Updating the game

Push to `dev` (GitHub Pages redeploys), then re-open the app (or leave it in the background
for more than 10 minutes). Each load appends `?v=<timestamp>` so `index.html` is always fresh.
The APK only changes if the wrapper itself changes.
