import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadMergeHelper() {
  const storage = new Map();
  const localStorage = {
    get length() { return storage.size; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    key(index) { return [...storage.keys()][index] || null; },
    removeItem(key) { storage.delete(key); },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  const document = {
    readyState: "loading",
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = {
    __IM_TEST__: true,
    addEventListener() {},
    dispatchEvent() {},
    IMUtils: {},
  };
  const context = {
    clearTimeout,
    console,
    document,
    localStorage,
    setTimeout,
    window,
  };
  vm.runInNewContext(readFileSync(new URL("../scripts/firebase-auth.js", import.meta.url), "utf8"), context);
  return window.IMAuthTestHooks.mergePersonalData;
}

test("guest learning data merges without losing newer cloud state", () => {
  const merge = loadMergeHelper();
  const cloud = {
    progress: {
      lessonA: { currentTime: 120, duration: 600, completed: false, updatedAt: 200 },
      lessonB: { currentTime: 300, duration: 600, completed: false, updatedAt: 500 },
    },
    notes: {
      lessonA: { text: "cloud note", updatedAt: 300 },
    },
    savedItems: {
      shared: { key: "shared", title: "Cloud title", savedAt: 500 },
      cloudOnly: { key: "cloudOnly", title: "Cloud only", savedAt: 100 },
    },
    streak: {
      current: 2,
      best: 4,
      freezesAvailable: 1,
      publicOptIn: true,
      publicName: "Learner",
      days: { "2026-07-19": { seconds: 900, completed: true } },
      updatedAt: 500,
    },
    quranStreak: {
      current: 2,
      best: 3,
      lastCompletedDate: "2026-07-19",
      days: { "2026-07-19": { completed: true, minutes: 15 } },
      updatedAt: 500,
    },
  };
  const guest = {
    progress: {
      lessonA: { currentTime: 600, duration: 600, completed: true, updatedAt: 100 },
      lessonB: { currentTime: 60, duration: 600, completed: false, updatedAt: 100 },
      guestOnly: { currentTime: 90, duration: 300, completed: false, updatedAt: 250 },
    },
    notes: {
      lessonA: { text: "newer guest note", updatedAt: 400 },
    },
    saved: [
      { key: "shared", title: "New guest title", savedAt: 700 },
      { key: "guestOnly", title: "Guest only", savedAt: 200 },
    ],
    streak: {
      current: 3,
      best: 5,
      freezesAvailable: 2,
      publicOptIn: false,
      days: {
        "2026-07-19": { seconds: 600, completed: false },
        "2026-07-20": { seconds: 450, completed: false },
      },
      updatedAt: 400,
    },
    quranStreak: {
      current: 3,
      best: 4,
      lastCompletedDate: "2026-07-20",
      days: { "2026-07-20": { completed: true, minutes: 15 } },
      updatedAt: 400,
    },
  };

  const result = merge(cloud, guest);

  assert.equal(result.progress.lessonA.completed, true);
  assert.equal(result.progress.lessonA.currentTime, 600);
  assert.equal(result.progress.lessonB.currentTime, 300);
  assert.equal(result.progress.guestOnly.currentTime, 90);
  assert.equal(result.notes.lessonA.text, "newer guest note");
  assert.deepEqual(
    [...result.saved].map((item) => item.key).sort(),
    ["cloudOnly", "guestOnly", "shared"],
  );
  assert.equal(result.saved.find((item) => item.key === "shared").title, "New guest title");
  assert.equal(result.streak.best, 5);
  assert.equal(result.streak.days["2026-07-19"].seconds, 900);
  assert.equal(result.streak.days["2026-07-20"].seconds, 450);
  assert.equal(result.streak.publicOptIn, true);
  assert.equal(result.streak.publicName, "Learner");
  assert.equal(result.quranStreak.current, 3);
  assert.equal(result.quranStreak.best, 4);
  assert.equal(result.quranStreak.lastCompletedDate, "2026-07-20");
  assert.equal(result.quranStreak.days["2026-07-19"].completed, true);
  assert.equal(result.quranStreak.days["2026-07-20"].completed, true);
});
