import assert from "node:assert/strict";
import test from "node:test";
import { applyPageShell } from "../scripts/page-shell.js";

const legacyPage = `<!doctype html>
<html>
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/example" rel="stylesheet" />
    <link rel="stylesheet" href="./styles/styles.css?v=old" />
    <script src="./scripts/theme.js?v=old"></script>
  </head>
  <body>
    <header class="site-header"><p>Old header</p></header>
    <main><h1>Unique content</h1></main>
    <footer class="site-footer"><p>Old footer</p></footer>
    <script src="./scripts/utils.js?v=old" defer></script>
    <script src="./scripts/streak-ui.js?v=old" defer></script>
    <script src="./scripts/example-page.js" defer></script>
    <nav class="bottom-nav" aria-label="Main navigation"><a href="./index.html">Old nav</a></nav>
    <script src="./scripts/nav-more.js" defer></script>
    <script src="./scripts/nav-state.js?v=old" defer></script>
    <script src="./scripts/firebase-auth.js?v=old" defer></script>
  </body>
</html>
`;

test("page shell migration preserves unique content and scripts", () => {
  const generated = applyPageShell(legacyPage);
  assert.match(generated, /<h1>Unique content<\/h1>/);
  assert.match(generated, /example-page\.js/);
  assert.match(generated, /page-shell:header:start/);
  assert.match(generated, /page-shell:footer:start/);
  assert.match(generated, /page-shell:bottom-nav:start/);
  assert.match(generated, /page-shell:runtime:start/);
  assert.match(generated, /class="desktop-nav-search"/);
  assert.match(generated, /class="desktop-sidebar"/);
  assert.match(generated, /class="site-menu page-menu sidebar-replaced-menu"/);
  assert.doesNotMatch(generated, /pages\/privacy\.html/);
  assert.equal((generated.match(/firebase-auth\.js/g) || []).length, 1);
  assert.equal((generated.match(/nav-state\.js/g) || []).length, 1);
});

test("page shell generation is idempotent", () => {
  const generated = applyPageShell(legacyPage);
  assert.equal(applyPageShell(generated), generated);
});

test("admin variant keeps the private footer and omits mobile bottom navigation", () => {
  const generated = applyPageShell(legacyPage, { admin: true });
  assert.match(generated, /Private product dashboard/);
  assert.doesNotMatch(generated, /<nav class="bottom-nav"/);
  assert.doesNotMatch(generated, /pages\/privacy\.html/);
  assert.doesNotMatch(generated, /class="desktop-sidebar"/);
  assert.doesNotMatch(generated, /class="desktop-nav-search"/);
  assert.doesNotMatch(generated, /sidebar-replaced-menu/);
});
