param(
  [string]$OutputName = "russia-pl-calculator-aliyun-fullstack.zip"
)

$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "package-aliyun-fullstack.ps1"
& powershell -ExecutionPolicy Bypass -File $script -OutputName $OutputName
