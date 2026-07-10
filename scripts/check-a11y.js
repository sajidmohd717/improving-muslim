import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const pageFiles = ["index.html", ...readdirSync("pages").filter((file) => file.endsWith(".html")).map((file) => join("pages", file))];
const failures = [];

function textWithoutTags(html) {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? match[2] ?? match[3] ?? match[4] ?? "" : null;
}

function report(file, message) {
  failures.push(`${file}: ${message}`);
}

for (const file of pageFiles) {
  const html = readFileSync(file, "utf8");

  if (!/<html[^>]+lang=["']en["']/i.test(html)) {
    report(file, "html element should declare lang=\"en\".");
  }

  if (!/<meta\s+name=["']viewport["'][^>]+content=["'][^"']*width=device-width/i.test(html)) {
    report(file, "missing responsive viewport meta tag.");
  }

  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) {
    report(file, "missing non-empty title.");
  }

  if (!/<main[\s>]/i.test(html)) {
    report(file, "missing main landmark.");
  }

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) {
    report(file, `expected exactly one h1, found ${h1Count}.`);
  }

  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  [...new Set(duplicateIds)].forEach((id) => report(file, `duplicate id "${id}".`));

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const alt = attr(match[0], "alt");
    if (alt === null) {
      report(file, `image is missing alt: ${match[0].slice(0, 90)}`);
    }
  }

  for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const ariaLabel = attr(match[0], "aria-label");
    const className = attr(match[0], "class") || "";
    const visibleText = textWithoutTags(match[1]);
    if (!ariaLabel && !visibleText) {
      report(file, "button needs visible text or aria-label.");
    }
    if (/\bnav-more-trigger\b/.test(className) && !ariaLabel) {
      report(file, "responsive More menu button needs an aria-label.");
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const tag = match[0];
    const href = attr(tag, "href");
    const ariaLabel = attr(tag, "aria-label");
    const visibleText = textWithoutTags(match[1]);

    if (!href) {
      report(file, "link is missing href.");
    }

    if (!ariaLabel && !visibleText) {
      report(file, `link needs visible text or aria-label: ${tag.slice(0, 90)}`);
    }

    if (attr(tag, "target") === "_blank" && !/\bnoopener\b/i.test(attr(tag, "rel") || "")) {
      report(file, "target=\"_blank\" link should include rel=\"noopener\".");
    }
  }

  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const id = attr(tag, "id");
    const ariaLabel = attr(tag, "aria-label");
    const hasLabel = id && new RegExp(`<label\\b[^>]*for=["']${id}["']`, "i").test(html);
    if (!ariaLabel && !hasLabel) {
      report(file, `input needs a label or aria-label: ${tag.slice(0, 90)}`);
    }
  }

  for (const match of html.matchAll(/<nav\b[^>]*>/gi)) {
    if (!attr(match[0], "aria-label") && !attr(match[0], "aria-labelledby")) {
      report(file, "nav landmark should have aria-label or aria-labelledby.");
    }
  }
}

if (failures.length) {
  console.error(`Accessibility checks failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Accessibility checks passed for ${pageFiles.length} page${pageFiles.length === 1 ? "" : "s"}.`);
