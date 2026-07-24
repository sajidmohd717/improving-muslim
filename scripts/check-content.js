/*
 * Deterministic catalog-integrity gate for maintained and generated content.
 * This deliberately performs no network requests so it remains stable in CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
const errors = [];
const warnings = [];
const canonicalOwners = new Map();
const videoOwners = new Map();
const maintainedFiles = new Set([
  "data/category-taxonomy.js",
  "data/series-registry.js",
  "data/speaker-data.js",
  "data/standalone-lectures-data.js",
]);

function cleanRelativePath(value) {
  return String(value || "").replace(/^\.\//, "").split("?")[0];
}

function absolutePath(value) {
  return join(root, cleanRelativePath(value));
}

function loadScript(relativePath) {
  const cleanPath = cleanRelativePath(relativePath);
  maintainedFiles.add(cleanPath);
  if (!existsSync(join(root, cleanPath))) {
    errors.push(`Missing maintained data file: ${cleanPath}.`);
    return;
  }
  try {
    runInNewContext(readFileSync(join(root, cleanPath), "utf8"), sandbox, { filename: cleanPath });
  } catch (error) {
    errors.push(`Could not load ${cleanPath}: ${error.message}`);
  }
}

function ownerLabel(kind, id) {
  return `${kind} "${id || "unknown"}"`;
}

function requireText(owner, field, value) {
  if (!String(value || "").trim()) errors.push(`${owner} is missing ${field}.`);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateDate(owner, value) {
  if (!validDate(value)) errors.push(`${owner} has an invalid publication date: ${JSON.stringify(value)}.`);
}

function validateDuration(owner, value, required = false) {
  if (value == null && !required) return;
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    errors.push(`${owner} has an invalid duration: ${JSON.stringify(value)}.`);
  }
}

function categoriesFor(entry) {
  return Array.isArray(entry?.categories) ? entry.categories : [entry?.category].filter(Boolean);
}

function validateCategories(owner, entry, knownCategories) {
  const categories = categoriesFor(entry);
  if (!categories.length) errors.push(`${owner} has an empty category array.`);
  if (new Set(categories).size !== categories.length) errors.push(`${owner} has duplicate categories.`);
  for (const category of categories) {
    if (!knownCategories.has(category)) errors.push(`${owner} uses unknown category "${category}".`);
  }
}

function validateLocalAsset(owner, field, value, required = true) {
  if (!value) {
    if (required) errors.push(`${owner} is missing ${field}.`);
    return;
  }
  if (/^https?:\/\//i.test(value)) {
    errors.push(`${owner} ${field} must be a repository-local path, not ${value}.`);
    return;
  }
  if (!existsSync(absolutePath(value))) errors.push(`${owner} references missing ${field}: ${value}.`);
}

function validateVideoUrl(owner, value) {
  if (!/^https:\/\/videos\.improvingmuslim\.com\/.+\.mp4(?:\?.*)?$/i.test(String(value || ""))) {
    errors.push(`${owner} has an invalid R2 video URL: ${JSON.stringify(value)}.`);
    return;
  }
  const previous = videoOwners.get(value);
  if (previous) errors.push(`${owner} reuses the video URL already owned by ${previous}: ${value}.`);
  else videoOwners.set(value, owner);
}

function registerCanonical(owner, route, filePath, sitemap, catalogKeys, catalogKey) {
  const previous = canonicalOwners.get(route);
  if (previous) errors.push(`${owner} duplicates canonical route ${route}, already owned by ${previous}.`);
  else canonicalOwners.set(route, owner);
  if (!existsSync(join(root, filePath))) errors.push(`${owner} is missing canonical page ${filePath}.`);
  const absoluteUrl = `https://improvingmuslim.com${route}`;
  if (!sitemap.includes(`<loc>${absoluteUrl}</loc>`)) errors.push(`${owner} is missing from sitemap.xml: ${absoluteUrl}.`);
  if (catalogKey && !catalogKeys.has(catalogKey)) errors.push(`${owner} is missing from data/catalog-data.js (${catalogKey}).`);
}

function episodeThumbnail(series, episode) {
  if (episode.thumbnailSrc) return episode.thumbnailSrc;
  if (series.episodeThumbnailPath && episode.number) {
    return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
  }
  return series.thumbnailSrc;
}

loadScript("data/category-taxonomy.js");
loadScript("data/series-registry.js");
loadScript("data/speaker-data.js");
loadScript("data/standalone-lectures-data.js");

const taxonomy = sandbox.window.IMCategoryTaxonomy;
const seriesConfig = sandbox.window.seriesConfig || [];
const speakers = sandbox.window.speakers || [];
const standaloneLectures = sandbox.window.standaloneLectures || [];

for (const entry of seriesConfig) {
  if (entry?.dataFile) loadScript(entry.dataFile);
}
loadScript("data/catalog-data.js");

const knownCategories = new Set((taxonomy?.topics || []).map((topic) => topic.value));
const speakersByName = new Map();
const speakersBySlug = new Map();
const seenSeriesSlugs = new Set();
const seenStandaloneIds = new Set();
const seenEpisodeIds = new Map();
const catalogItems = sandbox.window.catalogIndex?.items || [];
const catalogKeys = new Set(catalogItems.map((item) => item.key));
const expectedCatalogKeys = new Set();
const expectedCatalogUrls = new Map();
const sitemap = existsSync(join(root, "sitemap.xml")) ? readFileSync(join(root, "sitemap.xml"), "utf8") : "";

if (!knownCategories.size) errors.push("Category taxonomy is missing or empty.");
if (!seriesConfig.length) errors.push("Series registry is missing or empty.");
if (!speakers.length) errors.push("Speaker registry is missing or empty.");

for (const speaker of speakers) {
  const owner = ownerLabel("Speaker", speaker.slug || speaker.name);
  requireText(owner, "name", speaker.name);
  requireText(owner, "slug", speaker.slug);
  if (speakersByName.has(speaker.name)) errors.push(`${owner} duplicates speaker name "${speaker.name}".`);
  if (speakersBySlug.has(speaker.slug)) errors.push(`${owner} duplicates speaker slug "${speaker.slug}".`);
  speakersByName.set(speaker.name, speaker);
  speakersBySlug.set(speaker.slug, speaker);
  validateLocalAsset(owner, "image", speaker.image);
  if (!String(speaker.bio || "").trim()) warnings.push(`${owner} has no biography.`);
}

for (const entry of seriesConfig) {
  const owner = ownerLabel("Series", entry.slug || entry.title);
  requireText(owner, "slug", entry.slug);
  requireText(owner, "dataFile", entry.dataFile);
  requireText(owner, "globalKey", entry.globalKey);
  requireText(owner, "title", entry.title);
  requireText(owner, "speaker", entry.speaker);
  if (seenSeriesSlugs.has(entry.slug)) errors.push(`${owner} duplicates series slug "${entry.slug}".`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(entry.slug || ""))) errors.push(`${owner} has an invalid canonical slug.`);
  seenSeriesSlugs.add(entry.slug);
  if (!speakersByName.has(entry.speaker)) errors.push(`${owner} references unknown speaker "${entry.speaker}".`);
  validateCategories(owner, entry, knownCategories);
  validateLocalAsset(owner, "thumbnail", entry.thumbnailSrc);
  if (!String(entry.description || "").trim()) warnings.push(`${owner} has no description.`);

  const series = sandbox.window[entry.globalKey];
  if (!series) {
    errors.push(`${owner} data file did not expose window.${entry.globalKey}.`);
    continue;
  }
  if (!Array.isArray(series.episodes)) {
    errors.push(`${owner} has no episodes array.`);
    continue;
  }
  if (series.slug !== entry.slug) errors.push(`${owner} data slug does not match the registry.`);
  if (series.title !== entry.title) errors.push(`${owner} data title does not match the registry.`);
  if (series.speaker !== entry.speaker) errors.push(`${owner} data speaker does not match the registry.`);
  const episodeCount = Number(entry.episodeCount);
  const highestEpisodeNumber = series.episodes.reduce((highest, episode) => Math.max(highest, Number(episode.number) || 0), 0);
  if (!Number.isInteger(episodeCount) || episodeCount <= 0) {
    errors.push(`${owner} has an invalid episodeCount: ${JSON.stringify(entry.episodeCount)}.`);
  } else if (episodeCount < series.episodes.length || episodeCount < highestEpisodeNumber) {
    errors.push(`${owner} episodeCount is ${entry.episodeCount}, below its ${series.episodes.length} authored records or highest episode number ${highestEpisodeNumber}.`);
  }

  const availableEpisodes = series.episodes.filter((episode) => episode.videoSrc);
  if (!Number.isInteger(Number(entry.availableCount)) || Number(entry.availableCount) < 0) {
    errors.push(`${owner} has an invalid availableCount: ${JSON.stringify(entry.availableCount)}.`);
  } else if (Number(entry.availableCount) !== availableEpisodes.length) {
    errors.push(`${owner} availableCount is ${entry.availableCount}, but ${availableEpisodes.length} episodes have videoSrc.`);
  }
  registerCanonical(owner, `/series/${encodeURIComponent(entry.slug)}/`, `series/${entry.slug}/index.html`, sitemap, catalogKeys);

  const numbers = new Set();
  const ids = new Set();
  for (const episode of series.episodes) {
    const episodeOwner = `Episode "${entry.slug} #${episode.number || "?"}"`;
    requireText(episodeOwner, "ID", episode.id);
    requireText(episodeOwner, "title", episode.title);
    if (!/^[A-Za-z0-9_-]+$/.test(String(episode.id || ""))) errors.push(`${episodeOwner} has an invalid canonical ID.`);
    validateDate(episodeOwner, episode.published);
    validateDuration(episodeOwner, episode.duration, Boolean(episode.videoSrc || episode.youtubeId));
    if (!Number.isInteger(Number(episode.number)) || Number(episode.number) <= 0) {
      errors.push(`${episodeOwner} has an invalid episode number: ${JSON.stringify(episode.number)}.`);
    }
    if (numbers.has(episode.number)) errors.push(`${owner} contains duplicate episode number ${episode.number}.`);
    if (ids.has(episode.id)) errors.push(`${owner} contains duplicate episode ID "${episode.id}".`);
    numbers.add(episode.number);
    ids.add(episode.id);
    const globalEpisodeOwner = seenEpisodeIds.get(episode.id);
    if (globalEpisodeOwner) errors.push(`${episodeOwner} reuses episode ID "${episode.id}" from ${globalEpisodeOwner}.`);
    else seenEpisodeIds.set(episode.id, episodeOwner);
    if (episode.captionsSrc) validateLocalAsset(episodeOwner, "captions", episode.captionsSrc);

    if (episode.videoSrc) {
      validateVideoUrl(episodeOwner, episode.videoSrc);
      validateLocalAsset(episodeOwner, "thumbnail", episodeThumbnail(series, episode));
      const key = `episode:${entry.slug}:${episode.id}`;
      expectedCatalogKeys.add(key);
      expectedCatalogUrls.set(key, `./watch/${encodeURIComponent(entry.slug)}/${encodeURIComponent(episode.id)}/`);
      registerCanonical(
        episodeOwner,
        `/watch/${encodeURIComponent(entry.slug)}/${encodeURIComponent(episode.id)}/`,
        `watch/${entry.slug}/${episode.id}/index.html`,
        sitemap,
        catalogKeys,
        key,
      );
    }
  }
}

for (const lecture of standaloneLectures) {
  const owner = ownerLabel("Standalone lecture", lecture.id || lecture.title);
  requireText(owner, "ID", lecture.id);
  requireText(owner, "title", lecture.title);
  requireText(owner, "speaker", lecture.speaker);
  requireText(owner, "speakerSlug", lecture.speakerSlug);
  requireText(owner, "topic", lecture.topic);
  requireText(owner, "sourceUrl", lecture.sourceUrl);
  if (seenStandaloneIds.has(lecture.id)) errors.push(`${owner} duplicates standalone ID "${lecture.id}".`);
  seenStandaloneIds.add(lecture.id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(lecture.id || ""))) errors.push(`${owner} has an invalid canonical ID.`);
  if (seenEpisodeIds.has(lecture.id)) errors.push(`${owner} reuses the ID of ${seenEpisodeIds.get(lecture.id)}.`);
  const speaker = speakersBySlug.get(lecture.speakerSlug);
  if (!speaker) errors.push(`${owner} references unknown speaker slug "${lecture.speakerSlug}".`);
  else if (speaker.name !== lecture.speaker) errors.push(`${owner} speaker name does not match slug "${lecture.speakerSlug}".`);
  validateCategories(owner, lecture, knownCategories);
  validateDate(owner, lecture.published);
  validateDuration(owner, lecture.duration, true);
  validateLocalAsset(owner, "thumbnail", lecture.thumbnailSrc);
  if (lecture.captionsSrc) validateLocalAsset(owner, "captions", lecture.captionsSrc);
  if (!/^https?:\/\//i.test(String(lecture.sourceUrl || ""))) errors.push(`${owner} has an invalid sourceUrl.`);
  if (!String(lecture.description || "").trim()) warnings.push(`${owner} has no description.`);
  if (!lecture.videoSrc) errors.push(`${owner} is published without videoSrc.`);
  else validateVideoUrl(owner, lecture.videoSrc);

  if (lecture.videoSrc) {
    const key = `video:${lecture.id}`;
    expectedCatalogKeys.add(key);
    expectedCatalogUrls.set(key, `./watch/standalone/${encodeURIComponent(lecture.id)}/`);
    registerCanonical(
      owner,
      `/watch/standalone/${encodeURIComponent(lecture.id)}/`,
      `watch/standalone/${lecture.id}/index.html`,
      sitemap,
      catalogKeys,
      key,
    );
  }
}

const seenCatalogKeys = new Set();
for (const item of catalogItems) {
  if (seenCatalogKeys.has(item.key)) errors.push(`Generated catalog contains duplicate key "${item.key}".`);
  seenCatalogKeys.add(item.key);
  if (!expectedCatalogKeys.has(item.key)) errors.push(`Generated catalog contains unexpected or unavailable item "${item.key}".`);
  const expectedUrl = expectedCatalogUrls.get(item.key);
  if (expectedUrl && item.url !== expectedUrl) {
    errors.push(`Generated catalog item "${item.key}" uses ${item.url} instead of canonical URL ${expectedUrl}.`);
  }
}

const placeholderPattern = /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i;
for (const file of maintainedFiles) {
  if (!existsSync(join(root, file))) continue;
  const text = readFileSync(join(root, file), "utf8");
  if (placeholderPattern.test(text)) errors.push(`${file} contains a publishing placeholder such as TODO/TBD/FIXME.`);
}

if (warnings.length) {
  console.warn(`Content integrity warnings (${warnings.length}):\n- ${warnings.join("\n- ")}`);
}

if (errors.length) {
  console.error(`Content integrity check failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Content integrity check passed (${seriesConfig.length} series, ${expectedCatalogKeys.size - standaloneLectures.length} available episodes, ${standaloneLectures.length} standalone lectures, ${expectedCatalogKeys.size} catalog items).`,
);
