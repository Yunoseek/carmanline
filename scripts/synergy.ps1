$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$env:SYNERGY_HOME = Join-Path $project '.synergy-local'
$env:BUN_BE_BUN = '1'
$credentialFile = Join-Path $project '.synergy-local/provider-env.json'
if (Test-Path -LiteralPath $credentialFile) {
    $credential = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
    $env:DEEPSEEK_API_KEY = $credential.DEEPSEEK_API_KEY
}
$exe = Join-Path $project '.tools/synergy/node_modules/@ericsanchezok/synergy-windows-x64/bin/synergy.exe'
$entry = Join-Path $project '.tools/synergy/node_modules/@ericsanchezok/synergy-windows-x64/runtime/node_modules/@ericsanchezok/synergy-cli/dist/modules/launcher.js'
& $exe $entry @args
exit $LASTEXITCODE
