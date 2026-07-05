<#
.SYNOPSIS
  One-command YouTube to Cloudflare R2 video publisher.
  Downloads a YouTube video, fixes its moov atom, uploads to R2,
  and (optionally) inserts the videoSrc into the series data file.

.DESCRIPTION
  Three ways to run it:

  1. Interactive (just run it with no arguments): the script prompts for
     the YouTube URL, the bucket, and the filename, shows you the resolved
     object key + public URL to confirm, then downloads, fixes, and uploads.
     It can optionally write the videoSrc into a data file at the end.

  2. Single episode: pass -Series, -Episode, -Url. This runs the full
     pipeline including patching the series data file.

  3. Batch: pass -BatchFile pointing at a text file of "slug|episode|url"
     lines.

.PARAMETER Series
  Series slug as it appears in series-registry.js (e.g. "change-of-heart").

.PARAMETER Episode
  Episode number to publish.

.PARAMETER Url
  Full YouTube video URL.

.PARAMETER BatchFile
  Path to a text file with lines in the format: slug|episode|url
  Comments start with #. Skips blank lines.

.PARAMETER Interactive
  Force interactive prompt mode (this is also the default when no other
  arguments are given).

.PARAMETER SkipFix
  Skip the ffmpeg faststart step (use if the source is already web-optimized).

.PARAMETER DryRun
  Show every command that would run without executing anything.

.EXAMPLE
  .\scripts\publish.ps1
  .\scripts\publish.ps1 -Series "change-of-heart" -Episode 11 -Url "https://..."
  .\scripts\publish.ps1 -BatchFile "episodes.txt"
  .\scripts\publish.ps1 -Series "life-of-muhammad-mufti-menk" -Episode 4 -Url "https://..." -DryRun
#>

param(
  [string]$Series,
  [int]$Episode,
  [string]$Url,
  [string]$BatchFile,
  [switch]$Interactive,
  [switch]$SkipFix,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ---- config ----
$R2_BUCKET      = "islamic-lectures-videos"
$R2_ENDPOINT    = "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com"
$R2_PROFILE     = "r2"
$CDN_BASE       = "https://videos.improvingmuslim.com"
$TEMP_DIR       = Join-Path $PSScriptRoot "..\tmp\yt-dlp"
$SERIES_REGISTRY = Join-Path $PSScriptRoot "..\data\series-registry.js"

# yt-dlp format: best H.264/MP4 video + best AAC/M4A audio, merged to mp4.
# This caps at 1080p (YouTube's 1440p+ are VP9/AV1 webm, excluded on purpose
# so the output plays natively in the site's <video> element). You still only
# get whatever resolution YouTube actually stored for the source.
$YTDLP_FORMAT   = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"

# ---- helpers ----

function Write-Step { param([string]$Text) Write-Host "`n>>> $Text" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "    $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "    WARNING: $Text" -ForegroundColor Yellow }
function Write-Fail { param([string]$Text) Write-Host "    FAILED: $Text" -ForegroundColor Red }

function Run-Command {
  # Takes the full command as an argument array whose first element is the
  # executable. Invokes with the call operator so args with spaces, quotes,
  # and URL query strings are passed through verbatim (no string re-parsing).
  param([string[]]$CommandArgs, [string]$Desc)

  if ($DryRun) {
    Write-Host "    [DRY RUN] $Desc"
    Write-Host "    $($CommandArgs -join ' ')" -ForegroundColor DarkGray
    return
  }

  Write-Host "    $Desc"
  $exe = $CommandArgs[0]
  $rest = @()
  if ($CommandArgs.Count -gt 1) { $rest = $CommandArgs[1..($CommandArgs.Count - 1)] }
  & $exe @rest
  if ($LASTEXITCODE -ne 0) {
    throw "$Desc failed (exit code $LASTEXITCODE)"
  }
}

# Report the actual video resolution of a downloaded file using ffprobe.
function Get-Resolution {
  param([string]$File)
  try {
    $out = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 $File 2>$null
    if ($out) { return ($out | Select-Object -First 1).Trim() }
  }
  catch { }
  return $null
}

# ---- series registry lookup ----

function Get-SeriesEntry {
  param([string]$Slug)

  $content = Get-Content $SERIES_REGISTRY -Raw
  $escapedSlug = [regex]::Escape($Slug)

  if ($content -notmatch "slug:\s*`"$escapedSlug`"") {
    throw "Series slug '$Slug' not found in series-registry.js"
  }

  # Extract dataFile relative path. (?s) lets .*? span newlines, since slug and
  # dataFile sit on separate lines within the registry entry; lazy matching
  # grabs the nearest dataFile that follows the slug.
  $dataFileRel = ""
  if ($content -match "(?s)slug:\s*`"$escapedSlug`".*?dataFile:\s*`"([^`"]+)`"") {
    $dataFileRel = $matches[1]
  }
  if (-not $dataFileRel) {
    if ($content -match "(?s)dataFile:\s*`"([^`"]+)`".*?slug:\s*`"$escapedSlug`"") {
      $dataFileRel = $matches[1]
    }
  }

  # Strip any ?v= cache-bust suffix before resolving to a real path
  $dataFileRel = $dataFileRel -replace '\?.*$', ''

  # Resolve to absolute path (relative to project root)
  $projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $dataFileRel = $dataFileRel -replace '^\.\/', ''
  $dataFileAbs = Join-Path $projectRoot $dataFileRel

  return @{
    slug     = $Slug
    dataFile = $dataFileAbs
  }
}

# ---- R2 path detection ----

function Get-R2PathTemplate {
  param([string]$DataFile, [string]$Slug)

  $content = Get-Content $DataFile -Raw

  # Find any existing videoSrc to extract the naming pattern
  $escapedCdn = [regex]::Escape($CDN_BASE)
  $pattern = "videoSrc:\s*`"$escapedCdn/([^`"]+)`""

  if ($content -match $pattern) {
    $existingPath = $matches[1]
    Write-Ok "Found existing R2 path: $existingPath"

    $dir = Split-Path $existingPath -Parent
    $filename = Split-Path $existingPath -Leaf

    # Replace the episode number with a placeholder for templating
    if ($filename -match 'ep-(\d+)') {
      $template = $filename -replace 'ep-\d+', 'ep-{N}'
      if ($dir) { return "$dir/$template" }
      return $template
    }

    return $existingPath
  }

  # No existing videoSrc -- derive from slug
  Write-Warn "No existing videoSrc found, deriving R2 path from slug '$Slug'"
  return "$Slug/$Slug-ep-{N}.mp4"
}

function Get-R2Path {
  param([string]$Template, [int]$EpNum)

  if ($Template -match 'ep-\{N\}') {
    return $Template -replace '\{N\}', $EpNum
  }

  # Fallback: try replacing ep-XX with the episode number
  return $Template -replace 'ep-(\d+)', "ep-$EpNum"
}

# ---- data file patching ----

function Add-VideoSrc {
  param([string]$DataFile, [int]$EpNum, [string]$R2Path)

  $content = Get-Content $DataFile -Raw
  $videoSrcUrl = "$CDN_BASE/$R2Path"

  # Quick check: does the episode number exist at all?
  if ($content -notmatch "number:\s*$EpNum\b") {
    throw "Episode number $EpNum not found in $DataFile"
  }

  $lines = $content -split "`r?`n"
  $episodeStart = -1
  $episodeEnd = -1

  # Locate the episode object boundaries
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match "number:\s*$EpNum\b") {
      # Walk backwards to find the opening brace
      for ($j = $i; $j -ge 0; $j--) {
        if ($lines[$j] -match '\{') {
          $episodeStart = $j
          break
        }
      }
      # Walk forward to find the matching closing brace
      $depth = 0
      for ($j = $episodeStart; $j -lt $lines.Count; $j++) {
        $chars = $lines[$j].ToCharArray()
        foreach ($ch in $chars) {
          if ($ch -eq '{') { $depth++ }
          if ($ch -eq '}') { $depth-- }
        }
        if ($depth -eq 0) {
          $episodeEnd = $j
          break
        }
      }
      break
    }
  }

  if ($episodeStart -lt 0 -or $episodeEnd -lt 0) {
    throw "Could not locate episode $EpNum object boundaries"
  }

  $episodeBlock = ($lines[$episodeStart..$episodeEnd] -join "`n")

  if ($episodeBlock -match "videoSrc:") {
    # Replace existing videoSrc (works for both single- and multi-line objects)
    Write-Warn "Episode $EpNum already has a videoSrc, it will be replaced"
    $updatedBlock = [regex]::Replace($episodeBlock, 'videoSrc:\s*"[^"]*"', "videoSrc: `"$videoSrcUrl`"")
    $newLines = $updatedBlock -split "`n"
    for ($k = 0; $k -lt $newLines.Count; $k++) {
      $lines[$episodeStart + $k] = $newLines[$k]
    }
    Write-Ok "Updated existing videoSrc for episode $EpNum"
  }
  elseif ($episodeStart -eq $episodeEnd) {
    # Single-line object (e.g. life-of-muhammad): insert videoSrc INLINE, right
    # after the id: "..." token, so it stays inside the object's braces.
    $line = $lines[$episodeStart]
    if ($line -match 'id:\s*"[^"]+",?') {
      $line = [regex]::Replace($line, '(id:\s*"[^"]+",?)', "`$1 videoSrc: `"$videoSrcUrl`",", 1)
    }
    else {
      # Fallback: insert right after the opening brace
      $line = [regex]::Replace($line, '\{', "{ videoSrc: `"$videoSrcUrl`",", 1)
    }
    $lines[$episodeStart] = $line
    Write-Ok "Inserted inline videoSrc for episode $EpNum"
  }
  else {
    # Multi-line object: insert videoSrc on its own line after the id line
    # (or the number line as a fallback), matching the surrounding indentation.
    $insertAfter = -1
    for ($k = $episodeStart; $k -le $episodeEnd; $k++) {
      if ($lines[$k] -match 'id:\s*"[^"]+"') {
        $insertAfter = $k
      }
    }
    if ($insertAfter -lt 0) {
      for ($k = $episodeStart; $k -le $episodeEnd; $k++) {
        if ($lines[$k] -match "number:\s*$EpNum\b") {
          $insertAfter = $k
        }
      }
    }

    $indent = "        "
    if ($insertAfter -ge 0) {
      if ($lines[$insertAfter] -match '^(\s+)') {
        $indent = $matches[1]
      }
    }

    $newLine = "${indent}videoSrc: `"$videoSrcUrl`","

    $before = $lines[0..$insertAfter]
    $after  = $lines[($insertAfter + 1)..($lines.Count - 1)]
    $lines = $before + $newLine + $after
    Write-Ok "Inserted videoSrc for episode $EpNum"
  }

  # Write back
  $newContent = $lines -join "`r`n"
  if ($newContent -ne $content) {
    if ($DryRun) {
      Write-Host "    [DRY RUN] Would write to: $DataFile" -ForegroundColor DarkGray
      Write-Host "    videoSrc: `"$videoSrcUrl`"" -ForegroundColor DarkGray
    }
    else {
      Set-Content -Path $DataFile -Value $newContent -Encoding UTF8
      Write-Ok "Data file updated: $DataFile"
    }
  }
}

# ---- download + fix + upload building blocks ----

# Download from YouTube and (unless -SkipFix) remux with faststart. Writes the
# ready-to-upload file to "$DownloadDir\$BaseName.mp4". Does NOT return a value:
# the external tools' stdout would pollute the return, so callers compute the
# resulting path themselves from $DownloadDir + $BaseName.
function Get-LocalVideo {
  param([string]$Url, [string]$DownloadDir, [string]$BaseName)

  if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null
  }

  $rawFile   = Join-Path $DownloadDir "$BaseName-raw.mp4"
  $fixedFile = Join-Path $DownloadDir "$BaseName.mp4"

  Write-Step "Downloading from YouTube"
  $dlArgs = @(
    'yt-dlp',
    '-f', $YTDLP_FORMAT,
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-progress',
    '-o', $rawFile,
    $Url
  )
  Run-Command -CommandArgs $dlArgs -Desc "yt-dlp -> $rawFile"

  if ($SkipFix) {
    Write-Step "Skipping moov fix (--SkipFix)"
    if (-not $DryRun) {
      Move-Item $rawFile $fixedFile -Force
    }
  }
  else {
    Write-Step "Fixing moov atom (ffmpeg faststart)"
    $ffArgs = @(
      'ffmpeg',
      '-i', $rawFile,
      '-c', 'copy',
      '-movflags', 'faststart',
      $fixedFile,
      '-y',
      '-loglevel', 'warning'
    )
    Run-Command -CommandArgs $ffArgs -Desc "ffmpeg -> $fixedFile"
    if (-not $DryRun) {
      Remove-Item $rawFile -Force -ErrorAction SilentlyContinue
    }
  }

  if (-not $DryRun -and (Test-Path $fixedFile)) {
    $res = Get-Resolution -File $fixedFile
    if ($res) { Write-Ok "Downloaded quality: $res" }
  }

  Write-Ok "Local file ready: $fixedFile"
}

function Send-ToR2 {
  param([string]$LocalFile, [string]$Bucket, [string]$ObjectKey)

  Write-Step "Uploading to Cloudflare R2"
  $ulArgs = @(
    'aws', 's3', 'cp',
    $LocalFile,
    "s3://$Bucket/$ObjectKey",
    '--endpoint-url', $R2_ENDPOINT,
    '--content-type', 'video/mp4',
    '--profile', $R2_PROFILE
  )
  Run-Command -CommandArgs $ulArgs -Desc "aws s3 cp -> s3://$Bucket/$ObjectKey"
}

# ---- main pipeline (registry-driven) ----

function Publish-Episode {
  param([string]$Slug, [int]$EpNum, [string]$YouTubeUrl)

  Write-Step "Publishing: $Slug episode $EpNum"
  Write-Host "    YouTube: $YouTubeUrl"

  # 1. Lookup series
  $entry = Get-SeriesEntry -Slug $Slug
  Write-Ok "Data file: $($entry.dataFile)"

  # 2. Determine R2 path
  $r2Template = Get-R2PathTemplate -DataFile $entry.dataFile -Slug $Slug
  $r2Path = Get-R2Path -Template $r2Template -EpNum $EpNum
  $publicUrl = "$CDN_BASE/$r2Path"
  Write-Ok "R2 path: $r2Path"
  Write-Ok "Public URL: $publicUrl"

  # 3-5. Download + fix
  $downloadDir = Join-Path $TEMP_DIR $Slug
  $baseName = "$Slug-ep-$EpNum"
  Get-LocalVideo -Url $YouTubeUrl -DownloadDir $downloadDir -BaseName $baseName
  $fixedFile = Join-Path $downloadDir "$baseName.mp4"

  # 6. Upload to R2
  Send-ToR2 -LocalFile $fixedFile -Bucket $R2_BUCKET -ObjectKey $r2Path

  # 7. Update data file
  Write-Step "Updating data file with videoSrc"
  Add-VideoSrc -DataFile $entry.dataFile -EpNum $EpNum -R2Path $r2Path

  Write-Host "`n    Episode $EpNum published: $publicUrl" -ForegroundColor Green
  Write-Host "    Local copy kept at: $fixedFile" -ForegroundColor DarkGray
  Write-Warn "Remember to bump availableCount + cache-bust in series-registry.js, then run: npm run check"
}

# ---- batch mode ----

function Publish-Batch {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Batch file not found: $Path"
  }

  $lines = Get-Content $Path | Where-Object {
    $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$'
  }

  Write-Step "Batch mode: $($lines.Count) episodes to publish"

  $ok  = 0
  $fail = 0

  foreach ($line in $lines) {
    $parts = $line -split '\|'
    if ($parts.Count -lt 3) {
      Write-Warn "Skipping malformed line: $line"
      continue
    }

    $s = $parts[0].Trim()
    $e = [int]$parts[1].Trim()
    $u = ($parts[2..($parts.Count - 1)] -join '|').Trim()

    try {
      Publish-Episode -Slug $s -EpNum $e -YouTubeUrl $u
      $ok++
    }
    catch {
      Write-Fail "Episode $s #$e FAILED: $_"
      $fail++
    }
  }

  Write-Host "`nBatch complete: $ok succeeded, $fail failed" -ForegroundColor $(if ($fail -gt 0) { "Yellow" } else { "Green" })
}

# ---- interactive mode ----

function Invoke-Interactive {
  Write-Step "Interactive upload"

  $url = (Read-Host "YouTube URL").Trim()
  if (-not $url) { Write-Fail "No URL given."; return }

  $bucketInput = (Read-Host "R2 bucket [$R2_BUCKET]").Trim()
  $bucket = if ($bucketInput) { $bucketInput } else { $R2_BUCKET }

  $filename = (Read-Host "Filename to upload as (e.g. Life-of-Muhammad-PBUH-ep-4.mp4)").Trim()
  if (-not $filename) { Write-Fail "No filename given."; return }
  if ($filename -notmatch '\.\w+$') { $filename = "$filename.mp4" }

  # Suggest a folder derived from the filename ("Foo-ep-4.mp4" -> "Foo"),
  # which reproduces the existing "<folder>/<file>" layout in R2.
  $defaultFolder = ""
  if ($filename -match '^(.*)-ep-\d+\.\w+$') { $defaultFolder = $matches[1] }

  if ($defaultFolder) {
    $folderInput = (Read-Host "Folder/prefix in bucket [$defaultFolder]").Trim()
    $folder = if ($folderInput) { $folderInput.Trim('/') } else { $defaultFolder }
  }
  else {
    $folderInput = (Read-Host "Folder/prefix in bucket (blank = bucket root)").Trim()
    $folder = $folderInput.Trim('/')
  }

  $objectKey = if ($folder) { "$folder/$filename" } else { $filename }
  $publicUrl = "$CDN_BASE/$objectKey"

  Write-Host ""
  Write-Ok "Bucket:     $bucket"
  Write-Ok "Object key: $objectKey"
  Write-Ok "Public URL: $publicUrl"
  $confirm = (Read-Host "Proceed with download + upload? (y/N)").Trim()
  if ($confirm -notmatch '^(y|yes)$') { Write-Warn "Cancelled."; return }

  $downloadDir = Join-Path $TEMP_DIR "interactive"
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($filename)
  Get-LocalVideo -Url $url -DownloadDir $downloadDir -BaseName $baseName
  $fixedFile = Join-Path $downloadDir "$baseName.mp4"

  Send-ToR2 -LocalFile $fixedFile -Bucket $bucket -ObjectKey $objectKey

  Write-Host "`n    Uploaded: $publicUrl" -ForegroundColor Green
  Write-Host "    Local copy kept at: $fixedFile" -ForegroundColor DarkGray

  # Optional: also write the videoSrc into a data file.
  $patch = (Read-Host "Also write this videoSrc into a series data file? (y/N)").Trim()
  if ($patch -match '^(y|yes)$') {
    $slug = (Read-Host "Series slug (e.g. life-of-muhammad-mufti-menk)").Trim()
    $epNum = (Read-Host "Episode number").Trim()
    try {
      $entry = Get-SeriesEntry -Slug $slug
      Add-VideoSrc -DataFile $entry.dataFile -EpNum ([int]$epNum) -R2Path $objectKey
      Write-Warn "Remember to bump availableCount + cache-bust in series-registry.js, then run: npm run check"
    }
    catch {
      Write-Fail "Data file update failed: $_"
    }
  }
}

# ---- entry point ----

function Invoke-Main {
  Write-Host "`npublish.ps1 -- YouTube to R2 video publisher" -ForegroundColor Magenta
  if ($DryRun) {
    Write-Host "DRY RUN -- no changes will be made`n" -ForegroundColor Yellow
  }

  if ($BatchFile) {
    Publish-Batch -Path $BatchFile
  }
  elseif ($Series -and $Episode -and $Url) {
    Publish-Episode -Slug $Series -EpNum $Episode -YouTubeUrl $Url
  }
  elseif ($Interactive -or (-not $Series -and -not $Episode -and -not $Url -and -not $BatchFile)) {
    Invoke-Interactive
  }
  else {
    Write-Host @"

Usage:
  Interactive (prompts for URL, bucket, filename):
    .\scripts\publish.ps1

  Single episode (full pipeline + data file patch):
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <youtube-url>

  Batch mode:
    .\scripts\publish.ps1 -BatchFile <path-to-file>

  Dry run:
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <url> -DryRun

  Skip ffmpeg fix:
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <url> -SkipFix
"@
  }

  if ($DryRun) {
    Write-Host "`nDRY RUN complete -- nothing was changed." -ForegroundColor Yellow
  }
}

# Run main unless the script is being dot-sourced (e.g. for testing).
if ($MyInvocation.InvocationName -ne '.') {
  Invoke-Main
}
