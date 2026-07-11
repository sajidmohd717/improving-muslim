/*
 * Generates data/catalog-data.js — a flat, normalized index of every watchable
 * episode and standalone lecture, each with a weighted term vector built from
 * its title, description, keywords, takeaways, recap, and (when a caption file
 * exists) the lecture transcript. The watch page uses this index to rank
 * related lectures across the whole catalog.
 *
 *   node scripts/generate-catalog.js          rewrite data/catalog-data.js
 *   node scripts/generate-catalog.js --check  fail if the committed index is stale
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const OUTPUT_PATH = join(root, "data/catalog-data.js");

const sandbox = { window: {} };

function loadScript(relativePath) {
  const cleanPath = relativePath.replace(/^\.\//, "").split("?")[0];
  runInNewContext(readFileSync(join(root, cleanPath), "utf8"), sandbox, { filename: cleanPath });
}

loadScript("./data/series-registry.js");
for (const entry of sandbox.window.seriesConfig || []) {
  loadScript(entry.dataFile);
}
loadScript("./data/standalone-lectures-data.js");
loadScript("./data/speaker-data.js");

const speakerSlugByName = new Map(
  (sandbox.window.speakers || []).map((speaker) => [speaker.name, speaker.slug]),
);

function isEpisodeAvailable(episode) {
  return Boolean(episode?.videoSrc || episode?.youtubeId);
}

function episodeThumbnailUrl(series, episode) {
  if (episode?.thumbnailSrc) return episode.thumbnailSrc;
  if (series?.episodeThumbnailPath && episode?.number) {
    return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
  }
  return series?.thumbnailSrc || "./public/social-preview.png";
}

function plainText(value = "") {
  return String(value)
    .replace(/`+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that carry no topical signal. General English filler plus honorifics
// and transcript filler that appear in virtually every lecture.
const STOP_WORDS = new Set(`
  the of a an in on and or for to with about from into over under between
  is are was were be been being am do does did done has have had having
  will would can could shall should may might must not no nor so if then
  than that this these those there here it its they them their he she his
  her him you your yours we our ours i me my mine who whom whose which what
  when where why how all any both each few more most other some such only
  own same too very just also even still yet again once now out up down off
  one two three first second thing things something anything everything
  someone anyone everyone people person way ways time times day days year
  years get gets got getting go goes going gone went come comes coming came
  say says said saying know knows knew knowing look looks looking looked
  want wants wanted really actually basically literally right okay yes
  because therefore however moreover meaning example course part lot bit
  kind sort type make makes making made take takes taking took give gives
  giving gave see sees seeing saw tell tells telling told call calls called
  let lets us like liked
  allah subhanahu ta'ala wata'ala sallallahu salallahu alayhi alaihi wasallam
  wa sallam azza wajal ta'aala subhanallah alhamdulillah inshallah insha
  brothers sisters brother sister dear
  lecture lectures series episode episodes video videos speaker sheikh shaykh
`.trim().split(/\s+/));

function stemToken(token) {
  const stem = token.replace(/(ers|ies|ing|ed|es|s)$/, "");
  return stem.length >= 4 ? stem : token;
}

function tokenize(text) {
  return plainText(text)
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .map(stemToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function addTokens(counts, text, weight) {
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + weight);
  }
}

// Strips VTT structure (header, timestamps, cue settings) down to spoken text.
function transcriptText(captionsSrc) {
  if (!captionsSrc) return "";
  const cleanPath = captionsSrc.replace(/^\.\//, "").split("?")[0];
  const filePath = join(root, cleanPath);
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "WEBVTT") return false;
      if (/-->/.test(trimmed)) return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) return false;
      return true;
    })
    .join(" ");
}

const TRANSCRIPT_TOP_TERMS = 40;

function addTranscriptTokens(counts, captionsSrc) {
  const text = transcriptText(captionsSrc);
  if (!text) return;
  const frequency = new Map();
  for (const token of tokenize(text)) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }
  const top = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, TRANSCRIPT_TOP_TERMS);
  if (!top.length) return;
  const maxCount = top[0][1];
  for (const [token, count] of top) {
    // Scale 0.5–2.5 by relative in-transcript frequency, so transcripts inform
    // the vector without drowning out editorial metadata.
    counts.set(token, (counts.get(token) || 0) + 0.5 + 2 * (count / maxCount));
  }
}

const docs = [];

for (const entry of sandbox.window.seriesConfig || []) {
  const series = sandbox.window[entry.globalKey];
  if (!series || !Array.isArray(series.episodes)) continue;
  for (const episode of series.episodes) {
    if (!episode.videoSrc) continue; // YouTube-only episodes leave the site; skip them
    const counts = new Map();
    addTokens(counts, episode.title, 5);
    addTokens(counts, `${series.topic || ""} ${entry.topicKeywords || ""}`, 4);
    addTokens(counts, entry.searchKeywords || "", 3);
    addTokens(counts, episode.description || series.description || entry.description || "", 2);
    addTokens(counts, (episode.takeaways || []).join(" "), 2);
    addTokens(counts, episode.recap || "", 1);
    addTranscriptTokens(counts, episode.captionsSrc);
    docs.push({
      counts,
      item: {
        kind: "episode",
        key: `episode:${series.slug}:${episode.id}`,
        series: series.slug,
        seriesTitle: series.title,
        playlistId: series.playlistId,
        id: episode.id,
        number: episode.number,
        title: episode.title,
        speaker: series.speaker,
        speakerSlug: speakerSlugByName.get(series.speaker) || null,
        categories: entry.categories || [],
        duration: episode.duration || null,
        published: episode.published || null,
        url: `./watch/${encodeURIComponent(series.slug)}/${encodeURIComponent(episode.id)}/`,
        thumb: episodeThumbnailUrl(series, episode),
      },
    });
  }
}

for (const lecture of sandbox.window.standaloneLectures || []) {
  if (!lecture.videoSrc) continue;
  const counts = new Map();
  addTokens(counts, lecture.title, 5);
  addTokens(counts, lecture.topic || "", 4);
  addTokens(counts, lecture.searchKeywords || "", 3);
  addTokens(counts, lecture.description || "", 2);
  addTokens(counts, (lecture.takeaways || []).join(" "), 2);
  addTokens(counts, lecture.recap || "", 1);
  addTranscriptTokens(counts, lecture.captionsSrc);
  docs.push({
    counts,
    item: {
      kind: "standalone",
      key: `video:${lecture.id}`,
      series: null,
      seriesTitle: null,
      playlistId: "standalone",
      id: lecture.id,
      number: null,
      title: lecture.title,
      speaker: lecture.speaker,
      speakerSlug: lecture.speakerSlug || speakerSlugByName.get(lecture.speaker) || null,
      categories: lecture.categories || [],
      duration: lecture.duration || null,
      published: lecture.published || null,
      url: `./watch/standalone/${encodeURIComponent(lecture.id)}/`,
      thumb: lecture.thumbnailSrc || "./public/social-preview.png",
    },
  });
}

// TF-IDF: down-weights terms shared by most of the catalog ("iman", "heart")
// so vectors emphasize what distinguishes each lecture.
const documentFrequency = new Map();
for (const doc of docs) {
  for (const token of doc.counts.keys()) {
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
}

const TOP_TERMS = 24;

for (const doc of docs) {
  const scored = [...doc.counts.entries()].map(([token, tf]) => [
    token,
    tf * Math.log(1 + docs.length / documentFrequency.get(token)),
  ]);
  scored.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const top = scored.slice(0, TOP_TERMS);
  const max = top.length ? top[0][1] : 1;
  doc.item.terms = Object.fromEntries(
    top.map(([token, score]) => [token, Math.max(0.01, Math.round((score / max) * 100) / 100)]),
  );
}

const items = docs.map((doc) => doc.item);

const banner = `/*\n * Generated by scripts/generate-catalog.js — do not edit by hand.\n * Regenerate with: npm run catalog\n */\n`;
const output = `${banner}window.catalogIndex = ${JSON.stringify({ items }, null, 2)};\n`;

const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8").replace(/\r\n/g, "\n") : null;

if (checkOnly) {
  if (current !== output) {
    console.error("data/catalog-data.js is missing or stale. Run: npm run catalog");
    process.exit(1);
  }
  console.log(`Checked catalog index (${items.length} items).`);
} else {
  if (current !== output) writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote data/catalog-data.js (${items.length} items).`);
}
