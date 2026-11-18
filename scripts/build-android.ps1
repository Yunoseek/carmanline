$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$jdk = Get-ChildItem -LiteralPath (Join-Path $project '.tools/jdk') -Directory | Select-Object -First 1
if (-not $jdk) { throw 'Run python scripts/bootstrap_android.py first.' }
$env:JAVA_HOME = $jdk.FullName
$env:PATH = (Join-Path $jdk.FullName 'bin') + ';' + $env:PATH
$sdk = Join-Path $project '.tools/android-sdk'
$tools = Join-Path $sdk 'build-tools/35.0.0'
$androidJar = (Get-ChildItem -LiteralPath (Join-Path $sdk 'platforms/android-35') -Recurse -Filter android.jar | Sort-Object FullName | Select-Object -First 1).FullName
$build = Join-Path $project 'build/android'
$dist = Join-Path $project 'dist'
New-Item -ItemType Directory -Force -Path $build,$dist,(Join-Path $build 'classes'),(Join-Path $build 'dex') | Out-Null
node scripts/prepare-assets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Asset preparation failed' }
& (Join-Path $tools 'aapt2.exe') compile --dir android/res -o (Join-Path $build 'resources.zip')
if ($LASTEXITCODE -ne 0) { throw 'Android resource compilation failed' }
& (Join-Path $tools 'aapt2.exe') link -I $androidJar --manifest android/AndroidManifest.xml --min-sdk-version 24 --target-sdk-version 35 -A web -o (Join-Path $build 'base.apk') (Join-Path $build 'resources.zip')
if ($LASTEXITCODE -ne 0) { throw 'Android resource linking failed' }
$sources = Get-ChildItem -LiteralPath android/src -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
& javac --release 8 -encoding UTF-8 -classpath $androidJar -d (Join-Path $build 'classes') @sources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed' }
& jar cf (Join-Path $build 'classes.jar') -C (Join-Path $build 'classes') .
& (Join-Path $tools 'd8.bat') --lib $androidJar --min-api 24 --output (Join-Path $build 'dex') (Join-Path $build 'classes.jar')
if ($LASTEXITCODE -ne 0) { throw 'DEX compilation failed' }
python scripts/package_apk.py
if ($LASTEXITCODE -ne 0) { throw 'APK packaging failed' }
& (Join-Path $tools 'zipalign.exe') -f 4 (Join-Path $build 'unsigned.apk') (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed' }
$key = Join-Path $project '.tools/demo-signing.jks'
if (-not (Test-Path -LiteralPath $key)) {
    & keytool -genkeypair -keystore $key -storepass android -keypass android -alias liushi-demo -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Liushi Demo,O=Local Development,C=CN' -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Demo key generation failed' }
}
$apk = Join-Path $dist 'carmanline-v0.3.1.apk'
& (Join-Path $tools 'apksigner.bat') sign --ks $key --ks-key-alias liushi-demo --ks-pass pass:android --key-pass pass:android --out $apk (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
& (Join-Path $tools 'apksigner.bat') verify --verbose $apk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
Get-Item -LiteralPath $apk | Select-Object FullName,Length
python -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" $apk
if ($LASTEXITCODE -ne 0) { throw 'APK checksum failed' }
