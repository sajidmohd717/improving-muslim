import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../scripts/watch-stall.js", import.meta.url), "utf8");

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(name) {
    this.names.add(name);
  }

  remove(name) {
    this.names.delete(name);
  }

  toggle(name, force) {
    if (force) this.names.add(name);
    else this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

function createHarness() {
  const retryButton = {
    clickHandler: null,
    addEventListener(type, handler) {
      if (type === "click") this.clickHandler = handler;
    },
    click() {
      this.clickHandler?.();
    },
  };
  const loading = { classList: new FakeClassList("is-hidden") };
  const unavailable = {
    classList: new FakeClassList("is-hidden"),
    innerHTML: "",
    querySelector(selector) {
      return selector === ".video-retry-btn" ? retryButton : null;
    },
  };
  const listeners = new Map();
  const player = {
    readyState: 0,
    error: null,
    currentSrc: "https://videos.example.test/lecture.mp4",
    buffered: { length: 0 },
    loadCalls: 0,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    emit(type) {
      for (const handler of listeners.get(type) || []) handler();
    },
    load() {
      this.loadCalls += 1;
    },
  };
  const timers = new Map();
  let nextTimer = 1;
  const sandbox = {
    window: {},
    document: {
      querySelector(selector) {
        if (selector === "#video-loading") return loading;
        if (selector === "#video-unavailable") return unavailable;
        return null;
      },
    },
    navigator: {},
    location: { href: "https://example.test/watch/", pathname: "/watch/" },
    MediaError: {
      MEDIA_ERR_NETWORK: 2,
      MEDIA_ERR_DECODE: 3,
      MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
    },
    FormData: class {
      set() {}
    },
    fetch: () => Promise.resolve(),
    setTimeout(handler) {
      const id = nextTimer++;
      timers.set(id, handler);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };

  runInNewContext(source, sandbox, { filename: "scripts/watch-stall.js" });
  sandbox.window.IMWatchStall.init({
    player,
    videoSrc: "https://videos.example.test/lecture.mp4",
  });

  return { loading, player, retryButton, timers, unavailable };
}

test("a stall never silently reloads and offers an explicit retry", () => {
  const { loading, player, retryButton, timers, unavailable } = createHarness();

  player.readyState = 1;
  player.emit("loadstart");
  assert.equal(loading.classList.contains("is-hidden"), false);

  const [stallTimer] = timers.values();
  stallTimer();

  assert.equal(player.loadCalls, 0);
  assert.equal(loading.classList.contains("is-hidden"), true);
  assert.equal(unavailable.classList.contains("is-hidden"), false);
  assert.match(unavailable.innerHTML, /Try again/);

  retryButton.click();
  assert.equal(player.loadCalls, 1);
  assert.equal(loading.classList.contains("is-hidden"), false);
});

test("resume seeking and rebuffering use native feedback after metadata", () => {
  const { loading, player } = createHarness();

  player.emit("loadstart");
  assert.equal(loading.classList.contains("is-hidden"), false);

  player.emit("loadedmetadata");
  assert.equal(loading.classList.contains("is-hidden"), true);

  player.emit("waiting");
  assert.equal(loading.classList.contains("is-hidden"), true);
});

test("a media network error does not trigger an automatic reload", () => {
  const { player, unavailable } = createHarness();

  player.error = { code: 2 };
  player.emit("error");

  assert.equal(player.loadCalls, 0);
  assert.equal(unavailable.classList.contains("is-hidden"), false);
  assert.match(unavailable.innerHTML, /Network error/);
});
