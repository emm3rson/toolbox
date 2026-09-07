# Stages the pinned qpdf build used by the Optimize PDFs tool.
#
# Downloads the immutable qpdf 12.4.1 MSVC64 archive, verifies its
# SHA-256 (fail closed on mismatch), and copies only qpdf.exe plus its
# nine required DLLs, plus license/provenance, into src-tauri/resources/qpdf/.
# Run manually from the repo root before packaging:
#
#   pwsh -NoProfile -ExecutionPolicy Bypass -File src-tauri/scripts/prepare-qpdf.ps1
#
# There is no runtime download: the app only consumes the staged files.

$ErrorActionPreference = 'Stop'

$Version = '12.4.1'
$ArchiveName = "qpdf-$Version-msvc64.zip"
$DownloadUrl = "https://github.com/qpdf/qpdf/releases/download/v$Version/$ArchiveName"
$ExpectedSha256 = '3cd016cd433ef7232e42f4c13348a49cc14907a3c7278ef4f99120593126f7a6'
$UpstreamUrl = 'https://github.com/qpdf/qpdf'
$LicenseUrl = "https://raw.githubusercontent.com/qpdf/qpdf/v$Version/LICENSE.txt"
$LicenseSha256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
$NoticeUrl = "https://raw.githubusercontent.com/qpdf/qpdf/v$Version/NOTICE.md"
$NoticeSha256 = 'b207f65a9e5491195ded63b2941199b19a4d30148871f2742c88eae7bfc513a6'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$StagingDir = Join-Path $RepoRoot 'src-tauri\resources\qpdf'

$RequiredDlls = @(
  'concrt140.dll',
  'msvcp140.dll',
  'msvcp140_1.dll',
  'msvcp140_2.dll',
  'msvcp140_atomic_wait.dll',
  'msvcp140_codecvt_ids.dll',
  'qpdf30.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll'
)

function Test-Staged {
  param([string]$Dir)
  $provenance = Join-Path $Dir 'PROVENANCE.txt'
  $license = Join-Path $Dir 'LICENSE'
  $notice = Join-Path $Dir 'NOTICE.md'
  if ((Test-Path (Join-Path $Dir 'qpdf.exe')) -and (Test-Path $license) -and (Test-Path $notice) -and (Test-Path $provenance)) {
    $content = Get-Content -LiteralPath $provenance -Raw -ErrorAction SilentlyContinue
    $actualLicenseHash = (Get-FileHash -LiteralPath $license -Algorithm SHA256).Hash
    $actualNoticeHash = (Get-FileHash -LiteralPath $notice -Algorithm SHA256).Hash
    if ($content -and $content.Contains($ExpectedSha256) -and
      $actualLicenseHash.Equals($LicenseSha256, [System.StringComparison]::OrdinalIgnoreCase) -and
      $actualNoticeHash.Equals($NoticeSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
      # also check DLLs
      foreach ($dll in $RequiredDlls) {
        if (-not (Test-Path (Join-Path $Dir $dll))) { return $false }
      }
      return $true
    }
  }
  return $false
}

if (Test-Staged -Dir $StagingDir) {
  Write-Host "already staged: $StagingDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("qpdf-staging-{0}-{1}" -f $PID, [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$archivePath = Join-Path $tempDir $ArchiveName
$extractDir = Join-Path $tempDir 'extract'
$licensePath = Join-Path $tempDir 'LICENSE.txt'
$noticePath = Join-Path $tempDir 'NOTICE.md'

try {
  Write-Host "downloading $DownloadUrl"
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $archivePath -UseBasicParsing

  $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
  if (-not $actualHash.Equals($ExpectedSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    Write-Error ("SHA-256 mismatch for {0}: expected {1}, got {2}. Download deleted; aborting." -f $ArchiveName, $ExpectedSha256, $actualHash)
    exit 1
  }
  Write-Host "SHA-256 verified: $actualHash"

  Invoke-WebRequest -Uri $LicenseUrl -OutFile $licensePath -UseBasicParsing
  Invoke-WebRequest -Uri $NoticeUrl -OutFile $noticePath -UseBasicParsing
  $actualLicenseHash = (Get-FileHash -LiteralPath $licensePath -Algorithm SHA256).Hash
  $actualNoticeHash = (Get-FileHash -LiteralPath $noticePath -Algorithm SHA256).Hash
  if (-not $actualLicenseHash.Equals($LicenseSha256, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not $actualNoticeHash.Equals($NoticeSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Error 'qpdf license or NOTICE hash mismatch. Aborting.'
    exit 1
  }

  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

  $inner = Get-ChildItem -LiteralPath $extractDir -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\qpdf.exe') } |
    Select-Object -First 1
  if ($null -eq $inner) {
    Write-Error "Could not find an extracted directory containing bin/qpdf.exe. Aborting."
    exit 1
  }

  $binDir = Join-Path $inner.FullName 'bin'
  $qpdfExe = Join-Path $binDir 'qpdf.exe'
  if (-not (Test-Path -LiteralPath $qpdfExe)) {
    Write-Error "Required file missing from archive layout: $qpdfExe. Aborting."
    exit 1
  }
  foreach ($dll in $RequiredDlls) {
    $dllPath = Join-Path $binDir $dll
    if (-not (Test-Path -LiteralPath $dllPath)) {
      Write-Error "Required DLL missing from archive layout: $dllPath. Aborting."
      exit 1
    }
  }

  # Copy minimal runtime: qpdf.exe + 9 DLLs
  Copy-Item -LiteralPath $qpdfExe -Destination (Join-Path $StagingDir 'qpdf.exe') -Force
  foreach ($dll in $RequiredDlls) {
    Copy-Item -LiteralPath (Join-Path $binDir $dll) -Destination (Join-Path $StagingDir $dll) -Force
  }

  # Ship the exact upstream license and NOTICE, both pinned by hash.
  Copy-Item -LiteralPath $licensePath -Destination (Join-Path $StagingDir 'LICENSE') -Force
  Copy-Item -LiteralPath $noticePath -Destination (Join-Path $StagingDir 'NOTICE.md') -Force

  $provenancePath = Join-Path $StagingDir 'PROVENANCE.txt'
  $stagedAt = (Get-Date).ToUniversalTime().ToString('o')
  @"
qpdf staging provenance
======================
version: $Version
archive: $ArchiveName
download URL: $DownloadUrl
SHA-256: $ExpectedSha256
upstream project: $UpstreamUrl
license: Apache-2.0 - see LICENSE in this directory
staged at: $stagedAt
runtime contents: qpdf.exe + 9 DLLs (concrt140.dll, msvcp140.dll, msvcp140_1.dll, msvcp140_2.dll, msvcp140_atomic_wait.dll, msvcp140_codecvt_ids.dll, qpdf30.dll, vcruntime140.dll, vcruntime140_1.dll) - ~9.1 MB uncompressed, relocatable Windows MSVC64 build
"@ | Set-Content -LiteralPath $provenancePath -Encoding utf8NoBOM

  Write-Host 'verifying staged binaries'
  $qpdfVersion = & (Join-Path $StagingDir 'qpdf.exe') --version 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $qpdfVersion -notmatch [regex]::Escape("qpdf version $Version")) {
    Write-Error "qpdf.exe --version did not report version $Version. Got: $qpdfVersion"
    exit 1
  }
  $qpdfCopyright = & (Join-Path $StagingDir 'qpdf.exe') --copyright 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $qpdfCopyright -notmatch 'Apache') {
    Write-Error "qpdf.exe --copyright did not report Apache license. Got: $qpdfCopyright"
    exit 1
  }
  # Verify --jpeg-quality support (required for Balanced/Smaller presets)
  $jpegHelp = & (Join-Path $StagingDir 'qpdf.exe') '--help=--jpeg-quality' 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Error "qpdf.exe does not support --jpeg-quality (required for image optimization). Got: $jpegHelp"
    exit 1
  }
  $optimizeHelp = & (Join-Path $StagingDir 'qpdf.exe') '--help=--optimize-images' 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Error "qpdf.exe does not support --optimize-images. Got: $optimizeHelp"
    exit 1
  }

  Write-Host 'staged files:'
  Get-ChildItem -LiteralPath $StagingDir -File | ForEach-Object {
    Write-Host ("  {0}  {1:N0} bytes" -f $_.Name, $_.Length)
  }
  $totalBytes = (Get-ChildItem -LiteralPath $StagingDir -File | Measure-Object -Property Length -Sum).Sum
  Write-Host ("Total: {0:N0} bytes ({1:N2} MB)" -f $totalBytes, ($totalBytes / 1MB))
  Write-Host "qpdf $Version staged successfully at $StagingDir"
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
