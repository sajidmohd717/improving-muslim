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

  3. Standalone lecture: pass -Standalone, -SpeakerSlug, -LectureSlug, and
     -Url. This derives the standard speaker/stand-alone object key, uploads
     the video, then scaffolds the mechanical metadata: it downloads the
     thumbnail, downloads + cleans the English captions, and prints a
     ready-to-fill metadata object (duration, published date, sourceUrl,
     thumbnailSrc, videoSrc, captionsSrc pre-populated; editorial fields left
     as TODO). Pass -NoScaffold to skip the metadata scaffolding.

  4. Series batch: pass -BatchFile pointing at a text file of "slug|episode|url"
     lines. Add -Standalone to switch the batch format to
     "speakerSlug|lectureSlug|url" lines for standalone lectures.

.PARAMETER Series
  Series slug as it appears in series-registry.js (e.g. "change-of-heart").

.PARAMETER Episode
  Episode number to publish.

.PARAMETER Url
  Full YouTube video URL.

.PARAMETER BatchFile
  Path to a text file with lines in the format: slug|episode|url
  Comments start with #. Skips blank lines.

.PARAMETER Standalone
  Publish a standalone lecture instead of a numbered series episode.

.PARAMETER SpeakerSlug
  Speaker folder slug for standalone mode (e.g. "abu-bakr-zoud").

.PARAMETER LectureSlug
  Filename slug for standalone mode (e.g. "effect-of-the-quran-in-our-life").

.PARAMETER Interactive
  Force interactive prompt mode (this is also the default when no other
  arguments are given).

.PARAMETER SkipFix
  Skip the ffmpeg faststart step (use if the source is already web-optimized).

.PARAMETER KeepLocal
  Keep the downloaded/fixed MP4 in tmp/yt-dlp after a successful upload.
  By default the local copy is deleted once R2 confirms the upload, so
  the download cache doesn't quietly grow on disk.

.PARAMETER NoScaffold
  Standalone mode only. Skip the post-upload metadata scaffolding (thumbnail
  download, caption download/clean, and metadata stub). Upload only.

.PARAMETER DryRun
  Show every command that would run without executing anything.

.EXAMPLE
  .\scripts\publish.ps1
  .\scripts\publish.ps1 -Series "change-of-heart" -Episode 11 -Url "https://..."
  .\scripts\publish.ps1 -BatchFile "episodes.txt"
  .\scripts\publish.ps1 -Standalone -SpeakerSlug "abu-bakr-zoud" -LectureSlug "effect-of-the-quran-in-our-life" -Url "https://..."
  .\scripts\publish.ps1 -Series "life-of-muhammad-mufti-menk" -Episode 4 -Url "https://..." -DryRun
  .\scripts\publish.ps1 -Series "change-of-heart" -Episode 11 -Url "https://..." -KeepLocal
#>

param(
  [string]$Series,
  [int]$Episode,
  [string]$Url,
  [string]$BatchFile,
  [switch]$Standalone,
  [string]$SpeakerSlug,
  [string]$LectureSlug,
  [switch]$Interactive,
  [switch]$SkipFix,
  [switch]$KeepLocal,
  [switch]$NoScaffold,
  [switch]$ScaffoldOnly,
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
$PROJECT_ROOT   = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$CLEAN_VTT      = Join-Path $PSScriptRoot "clean-vtt.js"

# yt-dlp format: best H.264 (avc1) video + best AAC/M4A audio, merged to mp4.
# Filtering on ext=mp4 alone is NOT enough: YouTube serves 1440p/4K as AV1
# inside an mp4 container too, and ext=mp4 would happily grab that. AV1
# playback is unreliable on older iOS/Safari and some Android WebViews, and
# this site plays video natively with no transcoding step, so we explicitly
# require the avc1 (H.264) codec, which caps out at 1080p on YouTube. You
# still only get whatever resolution YouTube actually stored for the source.
$YTDLP_FORMAT   = "bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/best[vcodec^=avc1][ext=mp4]/best[ext=mp4]/best"

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
  # Run-Command throws on a non-zero exit code, so reaching the line after
  # this call already means aws reported success.
  Run-Command -CommandArgs $ulArgs -Desc "aws s3 cp -> s3://$Bucket/$ObjectKey"
}

# Remove the local file once its upload is confirmed, unless the caller asked
# to keep it (-KeepLocal) or this is a dry run (nothing was ever written).
function Remove-LocalAfterUpload {
  param([string]$LocalFile)

  if ($DryRun) { return }

  if ($KeepLocal) {
    Write-Ok "Kept local copy (-KeepLocal): $LocalFile"
    return
  }

  Remove-Item $LocalFile -Force -ErrorAction SilentlyContinue
  Write-Ok "Deleted local copy after confirmed upload: $LocalFile"
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
  Remove-LocalAfterUpload -LocalFile $fixedFile

  # 7. Update data file
  Write-Step "Updating data file with videoSrc"
  Add-VideoSrc -DataFile $entry.dataFile -EpNum $EpNum -R2Path $r2Path

  Write-Host "`n    Episode $EpNum published: $publicUrl" -ForegroundColor Green
  Write-Warn "Remember to bump availableCount + cache-bust in series-registry.js, regenerate SEO pages + sitemap, then run npm run check."
}

# ---- standalone metadata scaffolding ----

# Fetch title, duration (seconds), upload date (YYYYMMDD), and video id from
# YouTube in a single yt-dlp metadata call (no download). Returns a hashtable,
# or $null if the lookup fails.
function Get-VideoMeta {
  param([string]$Url)
  try {
    $line = & yt-dlp --no-warnings --skip-download `
      --print "%(id)s|%(duration)s|%(upload_date)s|%(title)s" $Url 2>$null | Select-Object -First 1
    if (-not $line) { return $null }
    $parts = $line -split '\|', 4
    # yt-dlp --print --skip-download exits non-zero even on success (nothing was
    # downloaded); we validated the output ourselves, so clear the leaked code.
    $global:LASTEXITCODE = 0
    return @{
      id       = $parts[0]
      duration = $parts[1]
      uploaded = $parts[2]
      title    = $parts[3]
    }
  }
  catch { return $null }
}

# YYYYMMDD -> YYYY-MM-DD (returns "" if not an 8-digit date).
function Format-UploadDate {
  param([string]$Raw)
  if ($Raw -match '^\d{8}$') {
    return "{0}-{1}-{2}" -f $Raw.Substring(0, 4), $Raw.Substring(4, 2), $Raw.Substring(6, 2)
  }
  return ""
}

# Download the highest-quality thumbnail for a video id into the standalone
# thumbnail path. Tries maxresdefault first, falls back to hqdefault.
function Get-StandaloneThumbnail {
  param([string]$VideoId, [string]$Speaker, [string]$Lecture)

  $relDir = "assets/thumbnail/standalone/$Speaker"
  $absDir = Join-Path $PROJECT_ROOT $relDir
  $relPath = "$relDir/$Lecture.jpg"
  $absPath = Join-Path $PROJECT_ROOT "assets/thumbnail/standalone/$Speaker/$Lecture.jpg"

  if ($DryRun) {
    Write-Host "    [DRY RUN] Would download thumbnail -> $relPath" -ForegroundColor DarkGray
    return "./$relPath"
  }

  New-Item -ItemType Directory -Force -Path $absDir | Out-Null
  foreach ($variant in @("maxresdefault", "hqdefault")) {
    try {
      Invoke-WebRequest -Uri "https://img.youtube.com/vi/$VideoId/$variant.jpg" `
        -OutFile $absPath -ErrorAction Stop
      if ((Get-Item $absPath).Length -gt 1024) {
        Write-Ok "Thumbnail saved ($variant): $relPath"
        return "./$relPath"
      }
    }
    catch { }
  }
  Write-Warn "Could not download a thumbnail for video id $VideoId"
  return "./$relPath"
}

# Download English auto-captions, rename to the catalog path, and normalise them
# with clean-vtt.js. Returns the ./-relative captionsSrc, or "" if none exist.
function Get-StandaloneCaptions {
  param([string]$Url, [string]$Speaker, [string]$Lecture)

  $relDir = "assets/captions/standalone/$Speaker"
  $absDir = Join-Path $PROJECT_ROOT "assets/captions/standalone/$Speaker"
  $absVtt = Join-Path $absDir "$Lecture.vtt"
  $relPath = "$relDir/$Lecture.vtt"

  if ($DryRun) {
    Write-Host "    [DRY RUN] Would download + clean captions -> $relPath" -ForegroundColor DarkGray
    return "./$relPath"
  }

  New-Item -ItemType Directory -Force -Path $absDir | Out-Null

  # Prefer the original English auto-track (en-orig), but fall back to the plain
  # "en" auto-track: some videos only expose "en" (no "en-orig"), and requesting
  # only en-orig would silently skip captions for them.
  foreach ($lang in @("en-orig", "en")) {
    & yt-dlp --skip-download --write-auto-subs --sub-langs $lang --sub-format vtt `
      -o (Join-Path $absDir "$Lecture.%(ext)s") $Url *> $null
    $global:LASTEXITCODE = 0

    $langVtt = Join-Path $absDir "$Lecture.$lang.vtt"
    if (Test-Path $langVtt) {
      Move-Item $langVtt $absVtt -Force
      & node $CLEAN_VTT $absVtt *> $null
      $global:LASTEXITCODE = 0
      Write-Ok "Captions saved + cleaned ($lang): $relPath"
      return "./$relPath"
    }
  }

  Write-Warn "No English auto-captions available for this video (skipping captionsSrc)"
  return ""
}

# Print a ready-to-fill standalone lecture object with all the mechanical fields
# pre-populated. The editorial fields (categories, topic, description, takeaways,
# recap) are left as TODO placeholders for human/AI judgement.
function Write-StandaloneStub {
  param(
    [string]$Speaker, [string]$Lecture, [hashtable]$Meta,
    [string]$ThumbSrc, [string]$CaptionsSrc
  )

  $published = Format-UploadDate -Raw $Meta.uploaded
  $duration  = if ($Meta.duration) { $Meta.duration } else { "0" }
  $sourceUrl = "https://www.youtube.com/watch?v=$($Meta.id)"
  $videoSrc  = "$CDN_BASE/$Speaker/stand-alone/$Lecture.mp4"
  $capLine   = if ($CaptionsSrc) { "    captionsSrc: `"$CaptionsSrc`",`n" } else { "" }

  $stub = @"
  {
    id: "$Lecture",
    title: "$($Meta.title)",           // TODO: clean up title if needed
    speaker: "TODO: Speaker Name",
    speakerSlug: "$Speaker",
    categories: ["TODO"],              // e.g. ["purification"], ["quran"]
    topic: "TODO: Topic Display Name",
    typeLabel: "Standalone Video",
    published: "$published",
    duration: $duration,
    sourceUrl: "$sourceUrl",
    thumbnailSrc: "$ThumbSrc",
    videoSrc: "$videoSrc",
$capLine    description: "TODO: short description for cards.",
    // Optional editorial fields — add when the transcript has been reviewed:
    // takeaways: ["..."],
    // recap: ``# Section\n\nProse...``,
  },
"@

  Write-Step "Metadata stub for data/standalone-lectures-data.js"
  Write-Host $stub -ForegroundColor Gray
  Write-Warn "Fill the TODO fields, then paste this object into data/standalone-lectures-data.js before the closing '];'."
}

function Publish-Standalone {
  param([string]$Speaker, [string]$Lecture, [string]$YouTubeUrl)

  if ($Speaker -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "SpeakerSlug must be a lowercase kebab-case slug"
  }
  if ($Lecture -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "LectureSlug must be a lowercase kebab-case slug"
  }

  $objectKey = "$Speaker/stand-alone/$Lecture.mp4"
  $publicUrl = "$CDN_BASE/$objectKey"

  Write-Step "Publishing standalone lecture: $Lecture"
  Write-Host "    YouTube: $YouTubeUrl"
  Write-Ok "R2 path: $objectKey"
  Write-Ok "Public URL: $publicUrl"

  # -ScaffoldOnly skips the download/upload and just (re)generates the metadata
  # assets — useful when the video is already on R2 and you only need the
  # thumbnail, captions, and object stub.
  if (-not $ScaffoldOnly) {
    $downloadDir = Join-Path $TEMP_DIR "standalone\$Speaker"
    Get-LocalVideo -Url $YouTubeUrl -DownloadDir $downloadDir -BaseName $Lecture
    $fixedFile = Join-Path $downloadDir "$Lecture.mp4"

    Send-ToR2 -LocalFile $fixedFile -Bucket $R2_BUCKET -ObjectKey $objectKey
    Remove-LocalAfterUpload -LocalFile $fixedFile

    Write-Host "`n    Standalone lecture published: $publicUrl" -ForegroundColor Green
  }
  else {
    Write-Ok "Scaffold-only: skipping download + upload"
  }

  # Scaffold the mechanical metadata (thumbnail, captions, stub) unless opted out.
  if ($NoScaffold) {
    Write-Warn "Add its metadata to data/standalone-lectures-data.js, then regenerate SEO pages and the sitemap."
    return
  }

  Write-Step "Scaffolding standalone metadata"
  $meta = Get-VideoMeta -Url $YouTubeUrl
  if (-not $meta) {
    Write-Warn "Could not fetch video metadata; add the object to data/standalone-lectures-data.js by hand."
    return
  }
  $thumbSrc    = Get-StandaloneThumbnail -VideoId $meta.id -Speaker $Speaker -Lecture $Lecture
  $captionsSrc = Get-StandaloneCaptions -Url $YouTubeUrl -Speaker $Speaker -Lecture $Lecture
  Write-StandaloneStub -Speaker $Speaker -Lecture $Lecture -Meta $meta `
    -ThumbSrc $thumbSrc -CaptionsSrc $captionsSrc
  Write-Warn "After filling the stub: regenerate SEO pages + sitemap, then run npm run check."
}

# ---- standalone batch mode ----

function Publish-StandaloneBatch {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Batch file not found: $Path"
  }

  $lines = Get-Content $Path | Where-Object {
    $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$'
  }

  Write-Step "Standalone batch mode: $($lines.Count) lectures to publish"

  $ok = 0
  $fail = 0

  foreach ($line in $lines) {
    $parts = $line -split '\|'
    if ($parts.Count -lt 3) {
      Write-Warn "Skipping malformed line (expected speakerSlug|lectureSlug|url): $line"
      continue
    }

    $spk = $parts[0].Trim()
    $lec = $parts[1].Trim()
    $u = ($parts[2..($parts.Count - 1)] -join '|').Trim()

    try {
      Publish-Standalone -Speaker $spk -Lecture $lec -YouTubeUrl $u
      $ok++
    }
    catch {
      Write-Fail "Standalone $spk/$lec FAILED: $_"
      $fail++
    }
  }

  Write-Host "`nStandalone batch complete: $ok succeeded, $fail failed" -ForegroundColor $(if ($fail -gt 0) { "Yellow" } else { "Green" })
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
  Remove-LocalAfterUpload -LocalFile $fixedFile

  Write-Host "`n    Uploaded: $publicUrl" -ForegroundColor Green

  # Optional: also write the videoSrc into a data file.
  $patch = (Read-Host "Also write this videoSrc into a series data file? (y/N)").Trim()
  if ($patch -match '^(y|yes)$') {
    $slug = (Read-Host "Series slug (e.g. life-of-muhammad-mufti-menk)").Trim()
    $epNum = (Read-Host "Episode number").Trim()
    try {
      $entry = Get-SeriesEntry -Slug $slug
      Add-VideoSrc -DataFile $entry.dataFile -EpNum ([int]$epNum) -R2Path $objectKey
      Write-Warn "Remember to bump availableCount + cache-bust in series-registry.js, regenerate SEO pages + sitemap, then run npm run check."
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

  if ($Standalone -and $BatchFile) {
    Publish-StandaloneBatch -Path $BatchFile
  }
  elseif ($BatchFile) {
    Publish-Batch -Path $BatchFile
  }
  elseif ($Standalone -and $SpeakerSlug -and $LectureSlug -and $Url) {
    Publish-Standalone -Speaker $SpeakerSlug -Lecture $LectureSlug -YouTubeUrl $Url
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

  Standalone lecture (upload + auto-scaffold thumbnail, captions, metadata stub):
    .\scripts\publish.ps1 -Standalone -SpeakerSlug <speaker-slug> -LectureSlug <lecture-slug> -Url <youtube-url>

  Series batch mode (slug|episode|url lines):
    .\scripts\publish.ps1 -BatchFile <path-to-file>

  Standalone batch mode (speakerSlug|lectureSlug|url lines):
    .\scripts\publish.ps1 -Standalone -BatchFile <path-to-file>

  Dry run:
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <url> -DryRun

  Skip ffmpeg fix:
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <url> -SkipFix

  Keep the local MP4 after uploading (deleted by default):
    .\scripts\publish.ps1 -Series <slug> -Episode <num> -Url <url> -KeepLocal
"@
  }

  if ($DryRun) {
    Write-Host "`nDRY RUN complete -- nothing was changed." -ForegroundColor Yellow
  }
}

# Run main unless the script is being dot-sourced (e.g. for testing).
# Reaching the line after Invoke-Main means no terminating error occurred
# (ErrorActionPreference = Stop), so report a clean exit code even if a helper's
# native tool (e.g. yt-dlp --print) left a non-zero code behind.
if ($MyInvocation.InvocationName -ne '.') {
  Invoke-Main
  exit 0
}
