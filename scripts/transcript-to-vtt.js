#!/usr/bin/env node
/**
 * transcript-to-vtt.js
 * Converts a YouTube-export transcript to WebVTT format.
 *
 * Input format (one caption per line):
 *   0:099 secondshow good does it feel...
 *   1:071 minute, 7 secondsvisiting the houses...
 *   3:003 minutesbrothers in the masjid...
 *
 * Chapter headers (e.g. "Chapter 1: Introduction") are skipped.
 * [Music] markers are preserved.
 *
 * Usage:
 *   node scripts/transcript-to-vtt.js < raw-transcript.txt > assets/captions/output.vtt
 *   node scripts/transcript-to-vtt.js path/to/raw.txt > output.vtt
 */

import fs from "node:fs";

const MAX_WORDS_PER_CUE = 8;

const inputFile = process.argv[2];
const raw = inputFile
  ? fs.readFileSync(inputFile, "utf8")
  : fs.readFileSync(0, "utf8");

const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

// Parse each line into { startSecs, text }
// Timestamp pattern: M:SS or MM:SS at start of line
// Human duration: "9 seconds", "1 minute, 7 seconds", "3 minutes", etc.
const TIMESTAMP_RE = /^(\d+):(\d{2})(\d+ minutes?, \d+ seconds?|\d+ minutes?|\d+ seconds?)(.*)/;

const cues = [];

for (const line of lines) {
  const match = line.match(TIMESTAMP_RE);
  if (!match) {
    // Skip chapter headers and blank lines
    continue;
  }
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  const startSecs = mins * 60 + secs;
  const text = match[4]
    .trim()
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-");
  if (text) {
    cues.push({ startSecs, text });
  }
}

// Format seconds to VTT timestamp HH:MM:SS.000
function toVtt(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const ms = Math.round((totalSecs - Math.floor(totalSecs)) * 1000);
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    String(ms).padStart(3, "0")
  );
}

function splitText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CUE) {
    chunks.push(words.slice(i, i + MAX_WORDS_PER_CUE).join(" "));
  }

  return chunks.length ? chunks : [text];
}

// Build VTT output
const lines_out = ["WEBVTT", ""];

for (let i = 0; i < cues.length; i++) {
  const start = cues[i].startSecs;
  // End time = next cue's start, or +7s for the last cue
  const end = i + 1 < cues.length ? cues[i + 1].startSecs : start + 7;
  const chunks = splitText(cues[i].text);
  const duration = Math.max(0.5, end - start);
  const chunkDuration = duration / chunks.length;

  for (let j = 0; j < chunks.length; j++) {
    const chunkStart = start + chunkDuration * j;
    const chunkEnd = j === chunks.length - 1 ? end : start + chunkDuration * (j + 1);
    lines_out.push(`${toVtt(chunkStart)} --> ${toVtt(chunkEnd)}`);
    lines_out.push(chunks[j]);
    lines_out.push("");
  }
}

process.stdout.write(lines_out.join("\n"));
