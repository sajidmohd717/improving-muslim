/*
 * Rewrites the shared regions in maintained HTML pages.
 *
 *   node scripts/generate-page-shell.js          rewrite maintained pages
 *   node scripts/generate-page-shell.js --check  fail when output is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_PAGE_FILES, PUBLIC_PAGE_FILES, applyPageShell } from "./page-shell.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const pages = [
  ...PUBLIC_PAGE_FILES.map((relativePath) => ({ relativePath, home: relativePath === "index.html" })),
  ...ADMIN_PAGE_FILES.map((relativePath) => ({ relativePath, admin: true })),
];

let stale = 0;
for (const page of pages) {
  const target = join(root, page.relativePath);
  const current = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  const generated = applyPageShell(current, page);
  if (current === generated) continue;
  if (checkOnly) {
    console.error(`${page.relativePath} has a stale page shell. Run: npm run page-shell`);
    stale += 1;
  } else {
    writeFileSync(target, generated);
  }
}

if (stale) {
  console.error(`${stale} maintained page shell(s) are stale.`);
  process.exit(1);
}

console.log(`${checkOnly ? "Checked" : "Generated"} ${pages.length} maintained page shells.`);
