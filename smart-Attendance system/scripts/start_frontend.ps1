$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$projectRoot\frontend"

& npm run dev -- --host 127.0.0.1
