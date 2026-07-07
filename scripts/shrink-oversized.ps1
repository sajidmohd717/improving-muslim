<#
.SYNOPSIS
  Re-encodes R2 videos larger than Cloudflare's 512 MB edge-cache limit
  so they become cacheable, then uploads them back to the same object key.

.DESCRIPTION
  Cloudflare's free plan will not cache files over 512 MB, so oversized
  lectures always stream from the bucket region (Cf-Cache-Status: BYPASS).
  This script finds every object in the bucket above the limit and, for each:

    1. downloads it to tmp/shrink/
    2. two-pass H.264 re-encode targeting ~480 MB (bitrate derived from
       duration), 96k AAC audio, +faststart
    3. verifies the result is under 512 MB and playable metadata intact
    4. uploads back to the SAME key (URLs and data files stay unchanged)
    5. deletes the local copies

  Requires ffmpeg/ffprobe and the AWS CLI "r2" profile (same as publish.ps1).
  Expect roughly 10-30 minutes per file depending on CPU; run overnight.

.PARAMETER Key
  Re-encode a single object key instead of scanning the whole bucket.

.PARAMETER DryRun
  List what would be done (including computed bitrates) without encoding
  or uploading anything.

.PARAMETER KeepLocal
  Keep the re-encoded files in tmp/shrink after upload for spot-checking.

.EXAMPLE
  .\scripts\shrink-oversized.ps1 -DryRun
  .\scripts\shrink-oversized.ps1
  .\scripts\shrink-oversized.ps1 -Key "mufti-menk/stand-alone/purpose-of-creation.mp4"
#>

param(
  [string]$Key,
  [switch]$DryRun,
  [switch]$KeepLocal
)

$ErrorActionPreference = "Stop"

# ---- config (matches publish.ps1) ----
$R2_BUCKET   = "islamic-lectures-videos"
$R2_ENDPOINT = "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com"
$R2_PROFILE  = "r2"
$TEMP_DIR    = Join-Path $PSScriptRoot "..\tmp\shrink"

$CACHE_LIMIT_BYTES  = 512MB
$TARGET_BYTES       = 480MB   # margin under the limit for container overhead
$AUDIO_BITRATE_KBPS = 96
$MIN_VIDEO_KBPS     = 200     # refuse to encode below this; quality floor

foreach ($tool in @("ffmpeg", "ffprobe", "aws")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool not found on PATH."
  }
}

New-Item -ItemType Directory -Force $TEMP_DIR | Out-Null

# ---- find oversized objects ----
Write-Host "Scanning bucket for objects over $([math]::Round($CACHE_LIMIT_BYTES/1MB)) MB..." -ForegroundColor Cyan
$listing = aws s3 ls "s3://$R2_BUCKET" --recursive --endpoint-url $R2_ENDPOINT --profile $R2_PROFILE
if ($LASTEXITCODE -ne 0) { throw "Failed to list bucket." }

$targets = @()
foreach ($line in $listing) {
  # format: 2026-07-02 15:40:07  634907000 path/to/file.mp4
  if ($line -match '^\S+\s+\S+\s+(\d+)\s+(.+)$') {
    $size = [long]$Matches[1]
    $objKey = $Matches[2].Trim()
    if ($size -gt $CACHE_LIMIT_BYTES -and $objKey -like "*.mp4") {
      if (-not $Key -or $objKey -eq $Key) {
        $targets += [pscustomobject]@{ Key = $objKey; Size = $size }
      }
    }
  }
}

if ($Key -and $targets.Count -eq 0) { throw "Key '$Key' not found or not oversized." }
if ($targets.Count -eq 0) { Write-Host "Nothing over the limit. Done."; exit 0 }

Write-Host ("Found {0} oversized file(s):" -f $targets.Count)
$targets | ForEach-Object { Write-Host ("  {0,6:N0} MB  {1}" -f ($_.Size / 1MB), $_.Key) }
Write-Host ""

$done = 0
$failed = @()

foreach ($t in $targets) {
  $name    = Split-Path $t.Key -Leaf
  $src     = Join-Path $TEMP_DIR "src-$name"
  $out     = Join-Path $TEMP_DIR $name
  $passLog = Join-Path $TEMP_DIR "ffpass-$([IO.Path]::GetFileNameWithoutExtension($name))"

  Write-Host ("[{0}/{1}] {2}" -f ($done + $failed.Count + 1), $targets.Count, $t.Key) -ForegroundColor Cyan

  try {
    # probe duration from the remote URL first so DryRun needs no download
    $publicUrl = "https://videos.improvingmuslim.com/$($t.Key)"
    $duration = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $publicUrl)
    if ($duration -le 0) { throw "Could not read duration." }

    $totalKbps = [math]::Floor(($TARGET_BYTES * 8) / $duration / 1000)
    $videoKbps = $totalKbps - $AUDIO_BITRATE_KBPS
    if ($videoKbps -lt $MIN_VIDEO_KBPS) {
      throw "Computed video bitrate ${videoKbps}k is below the ${MIN_VIDEO_KBPS}k quality floor (video is $([math]::Round($duration/3600,1))h long). Handle manually."
    }

    Write-Host ("  duration {0:h\:mm\:ss}, target video bitrate {1}k + audio {2}k" -f [timespan]::FromSeconds($duration), $videoKbps, $AUDIO_BITRATE_KBPS)

    if ($DryRun) { $done++; continue }

    Write-Host "  downloading..."
    aws s3 cp "s3://$R2_BUCKET/$($t.Key)" $src --endpoint-url $R2_ENDPOINT --profile $R2_PROFILE --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Download failed." }

    Write-Host "  encoding pass 1/2..."
    ffmpeg -y -v error -i $src -c:v libx264 -b:v "${videoKbps}k" -preset slow -pass 1 -passlogfile $passLog -an -f mp4 NUL
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg pass 1 failed." }

    Write-Host "  encoding pass 2/2..."
    ffmpeg -y -v error -i $src -c:v libx264 -b:v "${videoKbps}k" -preset slow -pass 2 -passlogfile $passLog -c:a aac -b:a "${AUDIO_BITRATE_KBPS}k" -movflags +faststart $out
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg pass 2 failed." }

    $newSize = (Get-Item $out).Length
    if ($newSize -ge $CACHE_LIMIT_BYTES) { throw "Result is still $([math]::Round($newSize/1MB)) MB - over the cache limit." }
    $newDuration = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $out)
    if ([math]::Abs($newDuration - $duration) -gt 5) { throw "Duration mismatch after encode ($newDuration vs $duration)." }

    Write-Host ("  {0:N0} MB -> {1:N0} MB, uploading..." -f ($t.Size / 1MB), ($newSize / 1MB))
    aws s3 cp $out "s3://$R2_BUCKET/$($t.Key)" --endpoint-url $R2_ENDPOINT --profile $R2_PROFILE --content-type "video/mp4" --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Upload failed." }

    Write-Host "  done." -ForegroundColor Green
    $done++
  }
  catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $failed += $t.Key
  }
  finally {
    Remove-Item "$passLog*" -Force -ErrorAction SilentlyContinue
    if (-not $KeepLocal) {
      Remove-Item $src, $out -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host ""
Write-Host ("Finished: {0} succeeded, {1} failed." -f $done, $failed.Count) -ForegroundColor Cyan
if ($failed.Count -gt 0) {
  Write-Host "Failed keys (re-run with -Key to retry individually):"
  $failed | ForEach-Object { Write-Host "  $_" }
  exit 1
}
