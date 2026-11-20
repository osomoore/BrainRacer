param(
    [switch]$Install,
    [string]$Device
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Users\osomo\AndroidDev\jdk17' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\osomo\AndroidDev\sdk' }
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# local.properties (gitignored); Gradle wants forward slashes / escaped backslashes
$sdkEsc = $env:ANDROID_HOME -replace '\\', '/'
Set-Content -Path (Join-Path $PSScriptRoot 'local.properties') -Value "sdk.dir=$sdkEsc" -Encoding ascii

# Release keystore lives outside the repo
$ksFile = 'C:\Users\osomo\AndroidDev\brainracer-release.jks'
$ksProps = 'C:\Users\osomo\AndroidDev\brainracer-keystore.properties'
if (-not $env:BRAINRACER_KEYSTORE_PROPS -and -not (Test-Path $ksProps)) {
    if (Test-Path $ksFile) { throw "Keystore exists but $ksProps is missing; restore it or delete the keystore." }
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pw = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', 'x'
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $ksFile -alias brainracer -keyalg RSA -keysize 2048 `
        -validity 10000 -dname 'CN=BrainRacer' -storepass $pw -keypass $pw
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
    $lines = @(
        "storeFile=$($ksFile -replace '\\', '/')",
        "storePassword=$pw",
        "keyAlias=brainracer",
        "keyPassword=$pw"
    )
    Set-Content -Path $ksProps -Value $lines -Encoding ascii
    Write-Host "Created keystore $ksFile (BACK IT UP, with $ksProps)"
}

& .\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }

$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$apk = Get-ChildItem (Join-Path $PSScriptRoot 'app\build\outputs\apk\release') -Filter *.apk | Select-Object -First 1
Copy-Item $apk.FullName (Join-Path $out 'BrainRacerTV.apk') -Force
$dest = Join-Path $out 'BrainRacerTV.apk'
Write-Host "APK: $dest"

if ($Install) {
    $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    if ($Device) { & $adb connect $Device }
    & $adb install -r $dest
}
