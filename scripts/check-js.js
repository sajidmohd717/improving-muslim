/*
 * Syntax-checks every JavaScript file in scripts/ and data/ with `node --check`.
 * Replaces the old hand-maintained file list in package.json, so adding or
 * removing a series data file requires no check-list edit.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["scripts", "data"];

let checked = 0;
let failed = 0;

for (const dir of dirs) {
  for (const file of readdirSync(join(root, dir))) {
    if (!file.endsWith(".js")) continue;
    try {
      execFileSync(process.execPath, ["--check", join(root, dir, file)], { stdio: "pipe" });
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`Syntax error in ${dir}/${file}:`);
      console.error(String(error.stderr));
    }
  }
}

if (failed > 0) {
  console.error(`${failed} file(s) failed the syntax check.`);
  process.exit(1);
}
console.log(`Syntax check passed for ${checked} JS files.`);
