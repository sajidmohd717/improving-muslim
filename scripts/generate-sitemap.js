/*
 * Generates sitemap.xml from the series registry plus the static page list.
 * Series URLs always match data/series-registry.js, so adding or removing a
 * series never requires a manual sitemap edit.
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
  "/pages/privacy.html",
];

const sandbox = { window: {} };
runInNewContext(readFileSync(join(root, "data/series-registry.js"), "utf8"), sandbox);
const seriesConfig = sandbox.window.seriesConfig || [];
if (!seriesConfig.length) {
  console.error("No series found in data/series-registry.js — refusing to write an empty sitemap.");
  process.exit(1);
}

const urls = [
  ...staticPaths.map((p) => ORIGIN + p),
  ...seriesConfig.map((s) => `${ORIGIN}/pages/series-detail.html?id=${s.slug}`),
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
    console.error("sitemap.xml is out of date with the series registry. Run: npm run sitemap");
    process.exit(1);
  }
  console.log(`Sitemap matches the registry (${seriesConfig.length} series, ${urls.length} URLs).`);
} else {
  writeFileSync(target, xml);
  console.log(`Wrote sitemap.xml (${seriesConfig.length} series, ${urls.length} URLs).`);
}
