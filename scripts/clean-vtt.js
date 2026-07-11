#!/usr/bin/env node
/*
 * clean-vtt.js — normalise WebVTT caption files for native <track> rendering.
 *
 * YouTube auto-caption VTTs (downloaded via `yt-dlp --write-auto-subs`) pin
 * every cue to the far left with settings like `align:start position:0%` on the
 * timing line. The browser's native <track> renderer honours those settings, so
 * the captions render hard against the left edge instead of bottom-centre —
 * clearly visible on iOS/iPhone. This script strips the per-cue positioning
 * settings so captions fall back to the default bottom-centre placement.
 *
 * It only touches the cue TIMING lines (the ones containing `-->`); the cue text,
 * inline word-timing tags, and everything else are left untouched. Running it
 * again on an already-clean file is a no-op (idempotent).
 *
 * Usage:
 *   node scripts/clean-vtt.js <file-or-dir> [<file-or-dir> ...]
 *   node scripts/clean-vtt.js assets/captions            # whole tree
 *   node scripts/clean-vtt.js --check assets/captions    # exit 1 if any file would change
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const targets = args.filter((a) => a !== "--check");

if (targets.length === 0) {
  console.error("Usage: node scripts/clean-vtt.js [--check] <file-or-dir> ...");
  process.exit(2);
}

// Strip cue-setting tokens (align:, position:, size:, line:, region:, vertical:)
// that follow the end timestamp on a cue timing line. Keeps the two timestamps.
function cleanTimingLine(line) {
  const arrow = line.indexOf("-->");
  if (arrow === -1) return line;
  // Split into "<start> --> <end> <settings...>" and drop the trailing settings.
  const m = line.match(
    /^(\s*\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3})(.*)$/
  );
  if (!m) return line;
  return m[1];
}

function cleanContent(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/).map((l) => (l.includes("-->") ? cleanTimingLine(l) : l));
  return lines.join(eol);
}

function collectVtt(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".vtt") ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target)) {
    out.push(...collectVtt(path.join(target, entry)));
  }
  return out;
}

let changed = 0;
let scanned = 0;
for (const target of targets) {
  for (const file of collectVtt(target)) {
    scanned++;
    const original = fs.readFileSync(file, "utf8");
    const cleaned = cleanContent(original);
    if (cleaned !== original) {
      changed++;
      if (checkOnly) {
        console.log(`Would clean: ${file}`);
      } else {
        fs.writeFileSync(file, cleaned);
        console.log(`Cleaned: ${file}`);
      }
    }
  }
}

if (checkOnly && changed > 0) {
  console.error(
    `\n${changed} of ${scanned} VTT file(s) still have positioning cue settings. Run: node scripts/clean-vtt.js assets/captions`
  );
  process.exit(1);
}

console.log(
  checkOnly
    ? `All ${scanned} VTT file(s) are clean.`
    : `Done. ${changed} of ${scanned} VTT file(s) updated.`
);
