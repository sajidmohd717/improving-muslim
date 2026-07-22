/*
 * Generates sitemap.xml from the static page list, public category taxonomy,
 * series registry, and generated SEO watch pages. Category availability,
 * registered series, and uploaded lectures are picked up automatically.
 *
 *   node scripts/generate-sitemap.js          rewrite sitemap.xml
 *   node scripts/generate-sitemap.js --check  fail if sitemap.xml is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://improvingmuslim.com";

const staticPaths = [
  "/",
  "/pages/about.html",
  "/pages/series.html",
  "/pages/explore.html",
  "/pages/speakers.html",
  "/pages/community.html",
  "/pages/careers.html",
  "/pages/partnerships.html",
  "/pages/donations.html",
  "/pages/feedback.html",
];

const sandbox = { window: {} };

function loadScript(relativePath) {
  const cleanPath = relativePath.replace(/^\.\//, "").split("?")[0];
  runInNewContext(readFileSync(join(root, cleanPath), "utf8"), sandbox, { filename: cleanPath });
}

loadScript("./data/series-registry.js");
const seriesConfig = sandbox.window.seriesConfig || [];
if (!seriesConfig.length) {
  console.error("No series found in data/series-registry.js; refusing to write an empty sitemap.");
  process.exit(1);
}

for (const entry of seriesConfig) {
  loadScript(entry.dataFile);
}
loadScript("./data/standalone-lectures-data.js");

loadScript("./data/category-taxonomy.js");
const categoriesFor = (entry) => Array.isArray(entry?.categories) ? entry.categories : [entry?.category].filter(Boolean);
const standaloneLectures = sandbox.window.standaloneLectures || [];
const categoryUrls = (sandbox.window.IMCategoryTaxonomy?.topics || [])
  .filter((topic) => {
    if (!topic.public) return false;
    const availableEpisodes = seriesConfig
      .filter((series) => categoriesFor(series).includes(topic.value))
      .reduce((total, series) => total + Math.max(0, Number(series.availableCount) || 0), 0);
    const standaloneCount = standaloneLectures.filter(
      (lecture) => lecture.videoSrc && categoriesFor(lecture).includes(topic.value),
    ).length;
    return availableEpisodes + standaloneCount > 0;
  })
  .map((topic) => `${ORIGIN}/pages/category.html?category=${encodeURIComponent(topic.value)}`);

const seriesUrls = seriesConfig.map((series) => `${ORIGIN}/series/${encodeURIComponent(series.slug)}/`);
const watchUrls = seriesConfig.flatMap((entry) => {
  const series = sandbox.window[entry.globalKey];
  if (!series?.episodes) return [];
  return series.episodes
    .filter((episode) => episode.videoSrc)
    .map((episode) => `${ORIGIN}/watch/${encodeURIComponent(series.slug)}/${encodeURIComponent(episode.id)}/`);
});
const standaloneUrls = standaloneLectures
  .filter((lecture) => lecture.videoSrc)
  .map((lecture) => `${ORIGIN}/watch/standalone/${encodeURIComponent(lecture.id)}/`);

const urls = [
  ...staticPaths.map((p) => ORIGIN + p),
  ...categoryUrls,
  ...seriesUrls,
  ...watchUrls,
  ...standaloneUrls,
];

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`).join("\n") +
  "\n</urlset>\n";

const target = join(root, "sitemap.xml");

if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  if (current !== xml) {
    console.error("sitemap.xml is out of date. Run: npm run sitemap");
    process.exit(1);
  }
  console.log(`Sitemap matches generated routes (${categoryUrls.length} categories, ${seriesUrls.length} series, ${watchUrls.length + standaloneUrls.length} watch URLs, ${urls.length} total).`);
} else {
  writeFileSync(target, xml);
  console.log(`Wrote sitemap.xml (${categoryUrls.length} categories, ${seriesUrls.length} series, ${watchUrls.length + standaloneUrls.length} watch URLs, ${urls.length} total).`);
}
