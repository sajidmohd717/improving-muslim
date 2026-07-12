/*
 * Validates the canonical category taxonomy against maintained content data.
 * This check is intentionally local and deterministic so it can run in CI.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };

function loadScript(relativePath) {
  runInNewContext(readFileSync(join(root, relativePath), "utf8"), sandbox, { filename: relativePath });
}

loadScript("data/category-taxonomy.js");
loadScript("data/series-registry.js");
loadScript("data/standalone-lectures-data.js");

const taxonomy = sandbox.window.IMCategoryTaxonomy;
const topics = taxonomy?.topics || [];
const systemFilters = taxonomy?.systemFilters || [];
const homepageFilters = taxonomy?.homepageFilters || [];
const errors = [];

if (!taxonomy || !Array.isArray(topics) || !topics.length) {
  errors.push("data/category-taxonomy.js must expose a non-empty IMCategoryTaxonomy.topics array.");
}

function duplicateValues(items, field) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const value = item?.[field];
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

for (const field of ["value", "name"]) {
  const duplicates = duplicateValues(topics, field);
  if (duplicates.length) errors.push(`Duplicate taxonomy ${field}(s): ${duplicates.join(", ")}`);
  const filterDuplicates = duplicateValues(systemFilters, field);
  if (filterDuplicates.length) errors.push(`Duplicate system-filter ${field}(s): ${filterDuplicates.join(", ")}`);
}

const topicValues = new Set(topics.map((topic) => topic.value));
for (const filter of systemFilters) {
  if (!String(filter?.name || "").trim() || !String(filter?.value || "").trim()) {
    errors.push("Every system filter must define a non-empty name and value.");
  }
  if (topicValues.has(filter?.value)) {
    errors.push(`System filter "${filter.value}" conflicts with a topic slug.`);
  }
}
for (const requiredFilter of ["foryou", "available"]) {
  if (!systemFilters.some((filter) => filter.value === requiredFilter)) {
    errors.push(`Missing required homepage system filter "${requiredFilter}".`);
  }
}

for (const topic of topics) {
  if (!/^[a-z0-9-]+$/.test(topic?.value || "")) {
    errors.push(`Invalid category slug: ${JSON.stringify(topic?.value)}`);
  }
  if (!String(topic?.name || "").trim()) errors.push(`Category ${topic?.value || "(unknown)"} is missing a name.`);
  if (!String(topic?.description || "").trim()) errors.push(`Category ${topic?.value || "(unknown)"} is missing a description.`);
  if (!Array.isArray(topic?.aliases)) {
    errors.push(`Category ${topic?.value || "(unknown)"} must define an aliases array.`);
  } else if (topic.aliases.some((alias) => !String(alias || "").trim())) {
    errors.push(`Category ${topic?.value || "(unknown)"} contains an empty alias.`);
  }
  if (typeof topic?.public !== "boolean") errors.push(`Category ${topic?.value || "(unknown)"} must define public: true or false.`);
}

const expectedHomepageValues = systemFilters
  .concat(topics.filter((topic) => topic.public))
  .map((item) => item.value);
const homepageValues = homepageFilters.map((item) => item.value);
if (JSON.stringify(homepageValues) !== JSON.stringify(expectedHomepageValues)) {
  errors.push("homepageFilters must contain system filters followed by every public topic in taxonomy order.");
}

const topicByValue = new Map(topics.map((topic) => [topic.value, topic]));
const usedCategories = new Set();

function validateCategories(owner, entry) {
  const categories = Array.isArray(entry?.categories)
    ? entry.categories
    : [entry?.category].filter(Boolean);
  if (!categories.length) {
    errors.push(`${owner} has no categories.`);
    return;
  }
  if (new Set(categories).size !== categories.length) {
    errors.push(`${owner} contains duplicate categories: ${categories.join(", ")}`);
  }
  for (const category of categories) {
    usedCategories.add(category);
    if (!topicByValue.has(category)) errors.push(`${owner} uses unknown category "${category}".`);
  }
  const knownTopics = categories.map((category) => topicByValue.get(category)).filter(Boolean);
  if (knownTopics.length && !knownTopics.some((topic) => topic.public)) {
    errors.push(`${owner} has no public category and would have no category doorway.`);
  }
}

for (const series of sandbox.window.seriesConfig || []) {
  validateCategories(`Series "${series.slug || series.title || "unknown"}"`, series);
}
for (const lecture of sandbox.window.standaloneLectures || []) {
  validateCategories(`Standalone lecture "${lecture.id || lecture.title || "unknown"}"`, lecture);
}

if (errors.length) {
  console.error("Category taxonomy check failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

const unusedPublic = topics.filter((topic) => topic.public && !usedCategories.has(topic.value));
const suffix = unusedPublic.length
  ? `; coming soon: ${unusedPublic.map((topic) => topic.value).join(", ")}`
  : "";
console.log(`Category taxonomy check passed (${topics.length} topics, ${usedCategories.size} used${suffix}).`);
