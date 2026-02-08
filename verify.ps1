$Archive = $args[0]
$OutDir = "extracted"

if (-not $Archive) {
    Write-Host "Usage: ./verify.ps1 <archive_path>"
    exit 1
}

if (Test-Path $OutDir) {
    Remove-Item -Path $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

Get-Item $Archive | Select-Object Name, Length

# Use tar for .tar.gz files on Windows (available since Windows 10 build 17063)
tar -xzf $Archive -C $OutDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "Extraction successful"
    Write-Host "Starting HTTP server on port 8080..."

    Set-Location $OutDir
    python -m http.server 8082
}
else {
    Write-Host "Extraction failed (tar not found or error)."
    exit 1
}
