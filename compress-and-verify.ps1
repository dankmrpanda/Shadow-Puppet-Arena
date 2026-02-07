$InputFile = $args[0]

if (-not $InputFile) {
    Write-Host "Usage: ./compress-and-verify.ps1 <html_file>"
    exit 1
}

if (-not (Test-Path $InputFile)) {
    Write-Host "File not found: $InputFile"
    exit 1
}

$BaseName = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
$Archive = "$BaseName.tar.gz"
$TempDir = "index_temp"

# Compress
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
Copy-Item $InputFile "$TempDir\index.html" -Force
tar -czf $Archive -C $TempDir "index.html"
Remove-Item -Recurse -Force $TempDir

if (-not (Test-Path $Archive)) {
    Write-Host "Compression failed."
    exit 1
}

Get-Item $Archive | Select-Object Name, @{N="Size (KB)";E={[math]::Round($_.Length/1024,2)}}

# Run verify
& "$PSScriptRoot\verify.ps1" $Archive
