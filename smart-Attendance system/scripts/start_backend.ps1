$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$healthUrl = 'http://127.0.0.1:8000/api/health'
try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
    if ($health.status -eq 'ok' -and $health.database -eq 'postgresql') {
        Write-Host 'Backend is already running and healthy on http://127.0.0.1:8000'
        exit 0
    }
} catch {
    # The port may be held by a stale or unrelated process; inspect it below.
}

$connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
$connections | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -match 'python.exe' -and $_.CommandLine -match 'uvicorn backend\.main:(api|app)' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

& "$projectRoot\venv\Scripts\python.exe" -m uvicorn backend.main:api --host 127.0.0.1 --port 8000
