/*
 * Generates the public, platform-neutral catalog consumed by the native apps.
 * Maintained JavaScript data remains the only editorial source of truth.
 *
 *   node scripts/generate-mobile-api.js          rewrite generated outputs
 *   node scripts/generate-mobile-api.js --check  fail when outputs are stale
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const siteBaseURL = "https://improvingmuslim.com/";
const outputPaths = [
  join(root, "api/v1/catalog.json"),
  join(root, "ios/ImprovingMuslim/Resources/catalog.json"),
];
const sandbox = { window: {} };

function loadScript(relativePath) {
  const cleanPath = relativePath.replace(/^\.\//, "").split("?")[0];
  runInNewContext(readFileSync(join(root, cleanPath), "utf8"), sandbox, { filename: cleanPath });
}

function absoluteURL(value) {
  if (!value) return null;
  return new URL(value.replace(/^\.\//, ""), siteBaseURL).href;
}

function nullable(value) {
  return value === undefined ? null : value;
}

loadScript("./data/series-registry.js");
for (const entry of sandbox.window.seriesConfig || []) loadScript(entry.dataFile);
loadScript("./data/standalone-lectures-data.js");
loadScript("./data/speaker-data.js");
loadScript("./data/category-taxonomy.js");

const speakers = (sandbox.window.speakers || []).map((speaker) => ({
  id: speaker.slug,
  name: speaker.name,
  imageURL: absoluteURL(speaker.image),
  bio: speaker.bio,
}));
const speakerSlugByName = new Map(speakers.map((speaker) => [speaker.name, speaker.id]));

function episodeThumbnailURL(series, episode) {
  if (episode.thumbnailSrc) return absoluteURL(episode.thumbnailSrc);
  if (series.episodeThumbnailPath && episode.number) {
    return absoluteURL(`${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`);
  }
  return absoluteURL(series.thumbnailSrc || "./public/social-preview.png");
}

function learningFields(item) {
  return {
    description: nullable(item.description),
    takeaways: item.takeaways || [],
    recap: nullable(item.recap),
    grammarNotes: (item.grammarNotes || []).map((note) => (
      typeof note === "string" ? note : JSON.stringify(note)
    )),
  };
}

const series = (sandbox.window.seriesConfig || []).flatMap((entry) => {
  const source = sandbox.window[entry.globalKey];
  if (!source || !Array.isArray(source.episodes)) return [];
  return [{
    id: source.slug || entry.slug,
    title: source.title || entry.title,
    speakerID: speakerSlugByName.get(source.speaker || entry.speaker) || null,
    speaker: source.speaker || entry.speaker,
    topic: source.topic || entry.sectionTitle || null,
    categories: entry.categories || [],
    label: entry.label || null,
    description: source.description || entry.description || null,
    thumbnailURL: absoluteURL(source.thumbnailSrc || entry.thumbnailSrc),
    playlistID: source.playlistId || entry.playlistId,
    availableCount: source.episodes.filter((episode) => Boolean(episode.videoSrc)).length,
    episodeCount: source.episodes.length,
    episodes: source.episodes.map((episode) => ({
      id: episode.id,
      number: episode.number,
      title: episode.title,
      published: nullable(episode.published),
      duration: nullable(episode.duration),
      views: nullable(episode.views),
      thumbnailURL: episodeThumbnailURL(source, episode),
      videoURL: absoluteURL(episode.videoSrc),
      captionsURL: absoluteURL(episode.captionsSrc),
      statusNote: nullable(episode.statusNote),
      ...learningFields(episode),
    })),
  }];
});

const standaloneLectures = (sandbox.window.standaloneLectures || []).map((lecture) => ({
  id: lecture.id,
  title: lecture.title,
  speakerID: lecture.speakerSlug || speakerSlugByName.get(lecture.speaker) || null,
  speaker: lecture.speaker,
  topic: nullable(lecture.topic),
  categories: lecture.categories || [],
  typeLabel: lecture.typeLabel || "Standalone Lecture",
  published: nullable(lecture.published),
  duration: nullable(lecture.duration),
  views: nullable(lecture.views),
  thumbnailURL: absoluteURL(lecture.thumbnailSrc || "./public/social-preview.png"),
  videoURL: absoluteURL(lecture.videoSrc),
  captionsURL: absoluteURL(lecture.captionsSrc),
  ...learningFields(lecture),
}));

const topics = (sandbox.window.IMCategoryTaxonomy?.topics || [])
  .filter((topic) => topic.public)
  .map((topic) => ({
    id: topic.value,
    name: topic.name,
    description: topic.description,
    aliases: topic.aliases || [],
  }));

const counts = {
  series: series.length,
  speakers: speakers.length,
  availableLectures: series.reduce((sum, item) => sum + item.availableCount, 0)
    + standaloneLectures.filter((lecture) => lecture.videoURL).length,
};
const content = { schemaVersion: 1, counts, topics, speakers, series, standaloneLectures };
const catalogVersion = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16);
const output = `${JSON.stringify({ ...content, catalogVersion }, null, 2)}\n`;

let stale = false;
for (const outputPath of outputPaths) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n") : null;
  if (current === output) continue;
  if (checkOnly) {
    stale = true;
    console.error(`${outputPath.replace(`${root}\\`, "")} is missing or stale. Run: npm run mobile-api`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output);
  }
}

if (stale) process.exit(1);
console.log(`${checkOnly ? "Checked" : "Wrote"} mobile catalog ${catalogVersion} (${counts.availableLectures} available lectures).`);
