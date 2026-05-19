param(
    [string]$SourceModel = '..\..\tinyml\build\model.tflite',
    [string]$TargetModel = 'data\model.tflite'
)

$scriptRoot = Split-Path -Parent $PSCommandPath
$sourcePath = Resolve-Path -LiteralPath (Join-Path $scriptRoot $SourceModel) | Select-Object -ExpandProperty Path
$targetPath = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $TargetModel))
$targetDir = Split-Path -Parent $targetPath

if (-not (Test-Path $sourcePath)) {
    throw "Source model not found: $sourcePath"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -Force $sourcePath $targetPath

Write-Host "Copied model to: $targetPath"
Write-Host "Next step: use Arduino IDE / ESP32 Sketch Data Upload to flash the LittleFS image."
