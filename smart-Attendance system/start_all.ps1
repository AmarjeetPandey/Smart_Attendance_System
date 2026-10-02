$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -match 'python.exe' -and $_.CommandLine -match 'backend.main' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

$qrLanIp = '172.16.28.35'

try {
    New-NetFirewallRule -DisplayName 'Smart Attendance QR' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000 -ErrorAction Stop | Out-Null
} catch {
    Write-Host 'QR firewall rule already exists or could not be created automatically.'
}

try {
    New-NetFirewallRule -DisplayName 'Smart Attendance Camera' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5001 -ErrorAction Stop | Out-Null
} catch {
    Write-Host 'Camera firewall rule already exists or could not be created automatically.'
}

$qrCommand = @"
Set-Location '$projectRoot'
`$env:ATTENDANCE_ENABLE_HTTPS = '0'
`$env:ATTENDANCE_PORT = '5000'
`$env:ATTENDANCE_HOST = '0.0.0.0'
`$env:ATTENDANCE_BASE_URL = 'http://$qrLanIp:5000'
& '$projectRoot\venv\Scripts\python.exe' -m uvicorn backend.main:app --host 0.0.0.0 --port 5000
"@

$cameraCert = Join-Path $projectRoot '.certs\smart-attendance-local-server.crt'
$cameraKey = Join-Path $projectRoot '.certs\smart-attendance-local-server.key'

$cameraCommand = @"
Set-Location '$projectRoot'
`$env:ATTENDANCE_ENABLE_HTTPS = '1'
`$env:ATTENDANCE_PORT = '5001'
`$env:ATTENDANCE_HOST = '127.0.0.1'
`$env:ATTENDANCE_CERT_FILE = '$cameraCert'
`$env:ATTENDANCE_KEY_FILE = '$cameraKey'
& '$projectRoot\venv\Scripts\python.exe' -m uvicorn backend.main:app --host 127.0.0.1 --port 5001 --ssl-keyfile '$cameraKey' --ssl-certfile '$cameraCert'
"@

Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $qrCommand) -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cameraCommand) -WindowStyle Hidden

Write-Host 'QR app and camera app are starting...'
Write-Host "QR: http://$qrLanIp:5000"
Write-Host 'Camera: https://localhost:5001/face-attendance'
