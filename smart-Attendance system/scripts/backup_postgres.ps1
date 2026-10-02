param(
    [string]$OutputDirectory = ".\backups"
)

$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) {
    throw 'DATABASE_URL must be set before creating a backup.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputFile = Join-Path $OutputDirectory "smart-attendance-$timestamp.dump"

& pg_dump --format=custom --no-owner --file $outputFile $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Host "PostgreSQL backup created: $outputFile"
