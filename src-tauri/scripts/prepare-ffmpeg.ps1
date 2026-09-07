# Stages the pinned FFmpeg build used by the Video Processor tool.
#
# Downloads the immutable Gyan FFmpeg 9.0.1 essentials archive, verifies its
# SHA-256 (fail closed on mismatch), and copies only the two executables plus
# license/README files into src-tauri/resources/ffmpeg/. Run manually from the
# repo root before packaging:
#
#   pwsh -NoProfile -ExecutionPolicy Bypass -File src-tauri/scripts/prepare-ffmpeg.ps1
#
# There is no runtime download: the app only consumes the staged files.

$ErrorActionPreference = 'Stop'

$Version = '9.0.1'
$ArchiveName = 'ffmpeg-9.0.1-essentials_build.zip'
$DownloadUrl = "https://github.com/GyanD/codexffmpeg/releases/download/$Version/$ArchiveName"
$ExpectedSha256 = 'fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9'
$UpstreamUrl = 'https://github.com/GyanD/codexffmpeg'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$StagingDir = Join-Path $RepoRoot 'src-tauri\resources\ffmpeg'

function Test-Staged {
  param([string]$Dir)
  $provenance = Join-Path $Dir 'PROVENANCE.txt'
  if ((Test-Path (Join-Path $Dir 'ffmpeg.exe')) -and
      (Test-Path (Join-Path $Dir 'ffprobe.exe')) -and
      (Test-Path $provenance)) {
    $content = Get-Content -LiteralPath $provenance -Raw
    return $content -match [regex]::Escape($ExpectedSha256)
  }
  return $false
}

if (Test-Staged -Dir $StagingDir) {
  Write-Host "already staged: $StagingDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ffmpeg-staging-{0}-{1}" -f $PID, [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$archivePath = Join-Path $tempDir $ArchiveName
$extractDir = Join-Path $tempDir 'extract'

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

  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

  $inner = Get-ChildItem -LiteralPath $extractDir -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\ffmpeg.exe') } |
    Select-Object -First 1
  if ($null -eq $inner) {
    Write-Error "Could not find an extracted directory containing bin/ffmpeg.exe. Aborting."
    exit 1
  }

  $binDir = Join-Path $inner.FullName 'bin'
  # The pinned 9.0.1 essentials archive ships the license as 'LICENSE'
  # (no extension); accept 'LICENSE.txt' for robustness across versions.
  $license = @('LICENSE', 'LICENSE.txt') |
    ForEach-Object { Join-Path $inner.FullName $_ } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  $required = @(
    (Join-Path $binDir 'ffmpeg.exe'),
    (Join-Path $binDir 'ffprobe.exe'),
    $license
  )
  foreach ($file in $required) {
    if (-not $file -or -not (Test-Path -LiteralPath $file)) {
      Write-Error "Required file missing from archive layout: $file. Aborting."
      exit 1
    }
  }

  Copy-Item -LiteralPath (Join-Path $binDir 'ffmpeg.exe') -Destination (Join-Path $StagingDir 'ffmpeg.exe') -Force
  Copy-Item -LiteralPath (Join-Path $binDir 'ffprobe.exe') -Destination (Join-Path $StagingDir 'ffprobe.exe') -Force
  Copy-Item -LiteralPath $license -Destination (Join-Path $StagingDir (Split-Path $license -Leaf)) -Force
  $readme = Join-Path $inner.FullName 'README.txt'
  if (Test-Path -LiteralPath $readme) {
    Copy-Item -LiteralPath $readme -Destination (Join-Path $StagingDir 'README.txt') -Force
  }

  $provenancePath = Join-Path $StagingDir 'PROVENANCE.txt'
  $stagedAt = (Get-Date).ToUniversalTime().ToString('o')
  @"
FFmpeg staging provenance
=========================
version: $Version
archive: $ArchiveName
download URL: $DownloadUrl
SHA-256: $ExpectedSha256
upstream project: $UpstreamUrl
license: GPL-3.0 (essentials build). Redistribution requires bundling this
license text and publishing matching source/build provenance for FFmpeg and
its GPL components.
staged at: $stagedAt
"@ | Set-Content -LiteralPath $provenancePath -Encoding utf8NoBOM

  Write-Host 'verifying staged binaries'
  $ffmpegVersion = & (Join-Path $StagingDir 'ffmpeg.exe') -version 2>&1 | Out-String
  if ($ffmpegVersion -notmatch [regex]::Escape("ffmpeg version $Version")) {
    Write-Error "ffmpeg.exe -version did not report version $Version. Aborting."
    exit 1
  }
  if ($ffmpegVersion -notmatch [regex]::Escape('--enable-gpl')) {
    Write-Error "ffmpeg.exe -version did not report --enable-gpl. Aborting."
    exit 1
  }

  $encoders = & (Join-Path $StagingDir 'ffmpeg.exe') -hide_banner -encoders 2>&1 | Out-String
  foreach ($encoder in @('libx264', ' aac ', 'libvpx-vp9', 'libopus')) {
    if (-not $encoders.Contains($encoder)) {
      Write-Error "ffmpeg.exe -encoders is missing required encoder '$encoder'. Aborting."
      exit 1
    }
  }

  $ffprobeVersion = & (Join-Path $StagingDir 'ffprobe.exe') -version 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $ffprobeVersion -notmatch [regex]::Escape('ffprobe version')) {
    Write-Error "ffprobe.exe -version failed. Aborting."
    exit 1
  }

  Write-Host 'staged files:'
  Get-ChildItem -LiteralPath $StagingDir -File | ForEach-Object {
    Write-Host ("  {0}  {1:N0} bytes" -f $_.Name, $_.Length)
  }
  Write-Host "FFmpeg $Version staged successfully at $StagingDir"
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
