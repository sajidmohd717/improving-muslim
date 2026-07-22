import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadActions({ initial = [], writeSucceeds = true, navigator = {} } = {}) {
  let items = structuredClone(initial);
  const window = {
    IMUtils: {
      readSavedItems: () => structuredClone(items),
      writeSavedItems: (next) => {
        if (!writeSucceeds) return false;
        items = structuredClone(next);
        return true;
      },
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../scripts/content-actions.js", import.meta.url), "utf8"),
    { navigator, window },
  );
  return { actions: window.IMContentActions, items: () => items };
}

test("saved-item actions toggle, deduplicate, and remove by stable key", () => {
  const { actions, items } = loadActions({ initial: [{ key: "older", savedAt: 1 }] });
  const item = { key: "series:test", title: "Test", savedAt: 2 };

  assert.equal(actions.isSaved("series:test"), false);
  let result = actions.toggleSaved(item);
  assert.equal(result.ok, true);
  assert.equal(result.saved, true);
  assert.equal(actions.isSaved(["series:other", "series:test"]), true);
  assert.deepEqual(items().map((entry) => entry.key), ["series:test", "older"]);

  result = actions.toggleSaved(item);
  assert.equal(result.ok, true);
  assert.equal(result.saved, false);
  assert.equal(actions.removeSaved("older"), true);
  assert.deepEqual(items(), []);
});

test("failed saved-item writes preserve the reported state", () => {
  const { actions } = loadActions({ initial: [{ key: "series:test" }], writeSucceeds: false });
  const existing = actions.toggleSaved({ key: "series:test" });
  assert.equal(existing.ok, false);
  assert.equal(existing.saved, true);
  const newItem = actions.toggleSaved({ key: "series:new" });
  assert.equal(newItem.ok, false);
  assert.equal(newItem.saved, false);
});

test("sharing prefers the native share sheet and falls back to clipboard", async () => {
  const shared = [];
  const native = loadActions({ navigator: { share: async (data) => shared.push(data) } }).actions;
  assert.equal(await native.shareContent({ title: "Title", text: "Text", url: "https://example.com" }), "shared");
  assert.equal(shared[0].title, "Title");

  const copied = [];
  const fallback = loadActions({ navigator: { clipboard: { writeText: async (url) => copied.push(url) } } }).actions;
  assert.equal(await fallback.shareContent({ title: "Title", text: "Text", url: "https://example.com" }), "copied");
  assert.deepEqual(copied, ["https://example.com"]);
});
