param(
  [string]$OutputName = "russia-pl-calculator-aliyun-fullstack.zip"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseDir = Join-Path $root "release"
$packageDir = Join-Path $releaseDir "aliyun-fullstack"
$zipPath = Join-Path $releaseDir $OutputName

Push-Location $root
try {
  npm run build

  if (Test-Path -LiteralPath $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $packageDir | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $packageDir "frontend-dist") | Out-Null

  Copy-Item -Path (Join-Path $root "dist\*") -Destination (Join-Path $packageDir "frontend-dist") -Recurse -Force
  Copy-Item -Path (Join-Path $root "backend_api") -Destination $packageDir -Recurse -Force
  Copy-Item -Path (Join-Path $root "alembic") -Destination $packageDir -Recurse -Force
  Copy-Item -Path (Join-Path $root "scripts\migrate_legacy_projects_to_backend.py") -Destination (Join-Path $packageDir "migrate_legacy_projects_to_backend.py") -Force
  Copy-Item -Path (Join-Path $root "requirements.txt") -Destination $packageDir -Force
  Copy-Item -Path (Join-Path $root "alembic.ini") -Destination $packageDir -Force
  Copy-Item -Path (Join-Path $root ".env.example") -Destination $packageDir -Force

  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  & tar.exe -a -cf $zipPath -C $packageDir .
  if ($LASTEXITCODE -ne 0) {
    throw "tar failed with exit code $LASTEXITCODE"
  }

  Get-Item -LiteralPath $zipPath | Select-Object FullName, Length, LastWriteTime
} finally {
  Pop-Location
}
