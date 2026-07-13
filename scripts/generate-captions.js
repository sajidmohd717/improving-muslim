#!/usr/bin/env node
/*
 * generate-captions.js -- transcribe a video with faster-whisper to produce
 * a WebVTT caption file, for videos with no existing YouTube captions to
 * fall back on (see scripts/transcript-to-vtt.js for that easier case).
 *
 * Pipeline: ffmpeg extracts audio (from a URL or local file) -> faster-whisper
 * (scripts/transcribe-whisper.py) transcribes it into timed cues -> clean-vtt.js
 * normalizes the result to match the rest of assets/captions/.
 *
 * Usage:
 *   node scripts/generate-captions.js <video-url-or-path> <output-vtt-path> \
 *     [--model medium] [--language en] [--prompt "term list to bias vocabulary"]
 *
 * Requires: ffmpeg on PATH, and `pip install faster-whisper`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const [videoSource, outputVttPath] = positional;

if (!videoSource || !outputVttPath) {
  console.error(
    'Usage: node scripts/generate-captions.js <video-url-or-path> <output-vtt-path> [--model medium] [--language en] [--prompt "..."]',
  );
  process.exit(2);
}

function flagValue(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const model = flagValue("model", "medium");
const language = flagValue("language", "en");
const prompt = flagValue("prompt", "");

fs.mkdirSync(path.dirname(outputVttPath), { recursive: true });

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "im-captions-"));
const audioPath = path.join(tempDir, "audio.wav");

try {
  console.log(`Extracting audio from ${videoSource} ...`);
  const ffmpegResult = spawnSync(
    "ffmpeg",
    ["-y", "-i", videoSource, "-vn", "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", audioPath],
    { stdio: "inherit" },
  );
  if (ffmpegResult.status !== 0) {
    console.error("ffmpeg failed to extract audio.");
    process.exit(1);
  }

  console.log(`Transcribing with faster-whisper (model=${model}, language=${language}) ...`);
  const whisperArgs = [
    path.join(scriptsDir, "transcribe-whisper.py"),
    audioPath,
    outputVttPath,
    "--model",
    model,
    "--language",
    language,
  ];
  if (prompt) whisperArgs.push("--prompt", prompt);

  const whisperResult = spawnSync("python", whisperArgs, { stdio: "inherit" });
  if (whisperResult.status !== 0) {
    console.error("faster-whisper transcription failed.");
    process.exit(1);
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("Cleaning VTT formatting ...");
const cleanResult = spawnSync("node", [path.join(scriptsDir, "clean-vtt.js"), outputVttPath], {
  stdio: "inherit",
});
if (cleanResult.status !== 0) {
  console.error("clean-vtt.js failed.");
  process.exit(1);
}

console.log(`Done: ${outputVttPath}`);
