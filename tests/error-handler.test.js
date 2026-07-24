import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const handlerSource = readFileSync(
  new URL("../scripts/error-handler.js", import.meta.url),
  "utf8",
);

function createHarness({
  href = "https://improvingmuslim.com/?utm_source=ig&utm_medium=social&q=private-search&fbclid=private-click-id",
} = {}) {
  const pageUrl = new URL(href);
  const listeners = new Map();
  const timers = [];
  const requests = [];
  const session = new Map();
  const retryButton = { addEventListener() {} };
  const main = {
    innerHTML: "",
    querySelector(selector) {
      return selector === "[data-error-retry]" ? retryButton : null;
    },
  };

  class TestFormData {
    constructor() {
      this.fields = new Map();
    }

    set(name, value) {
      this.fields.set(name, String(value));
    }

    get(name) {
      return this.fields.get(name);
    }
  }

  const context = {
    URL,
    URLSearchParams,
    FormData: TestFormData,
    location: {
      href: pageUrl.href,
      origin: pageUrl.origin,
      hostname: pageUrl.hostname,
      pathname: pageUrl.pathname,
      search: pageUrl.search,
      hash: pageUrl.hash,
      reload() {},
    },
    navigator: {
      userAgent: "Mozilla/5.0 (Linux; Android 16; SM-A165F Build/example; wv) Chrome/150.0.0.0 Instagram/439.0",
      language: "en-GB",
      maxTouchPoints: 5,
      onLine: true,
      connection: {
        effectiveType: "4g",
        downlink: 8,
        rtt: 50,
        saveData: false,
      },
    },
    performance: {
      now: () => 1234,
      getEntriesByType: () => [{ type: "navigate", transferSize: 24000 }],
    },
    sessionStorage: {
      getItem: (key) => session.get(key) || null,
      setItem: (key, value) => session.set(key, value),
    },
    fetch(url, options) {
      requests.push({ url, options });
      return Promise.resolve({ ok: true });
    },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    screen: { width: 1080, height: 2340 },
    innerWidth: 450,
    innerHeight: 780,
    devicePixelRatio: 2.4,
    crypto: {
      randomUUID: () => "12345678-1234-1234-1234-123456789abc",
    },
  };

  context.window = context;
  context.document = {
    currentScript: {
      getAttribute: (name) => name === "data-release" ? "test-release" : null,
    },
    readyState: "complete",
    visibilityState: "visible",
    hidden: false,
    referrer: "https://l.instagram.com/?u=private",
    baseURI: pageUrl.href,
    querySelector: (selector) => selector === "main" ? main : null,
    querySelectorAll: (selector) => selector === "script[src]"
      ? [{
          src: "https://improvingmuslim.com/scripts/error-handler.js?v=test",
        }]
      : [],
    addEventListener() {},
  };
  context.addEventListener = (name, callback) => {
    const callbacks = listeners.get(name) || [];
    callbacks.push(callback);
    listeners.set(name, callbacks);
  };

  runInNewContext(handlerSource, context, { filename: "error-handler.js" });

  return {
    context,
    listeners,
    main,
    requests,
    runTimers() {
      while (timers.length) timers.shift()();
    },
  };
}

test("recoverable resource failures are batched and do not replace the page", () => {
  const harness = createHarness();
  const resourceListener = harness.listeners.get("error")[0];
  resourceListener({
    target: {
      tagName: "SCRIPT",
      src: "https://improvingmuslim.com/scripts/home-shelves.js?v=broken",
      getAttribute: (name) => name === "data-error-severity" ? "recoverable" : null,
    },
  });
  harness.context.IMErrorReporter.reportRecoverable(
    "Optional homepage dependency IMHomeShelves is unavailable.",
    {
      kind: "dependency",
      source: "https://improvingmuslim.com/scripts/home-shelves.js",
      context: { dependency: "IMHomeShelves" },
    },
  );
  harness.runTimers();

  assert.equal(harness.main.innerHTML, "");
  assert.equal(harness.requests.length, 1);
  const payload = harness.requests[0].options.body;
  assert.equal(payload.get("severity"), "recoverable");
  assert.equal(payload.get("kind"), "resource");
  assert.equal(payload.get("release"), "test-release");
  assert.equal(payload.get("page"), "https://improvingmuslim.com/");
  assert.match(payload.get("query_keys"), /fbclid/);
  assert.match(payload.get("campaign"), /source=ig/);
  assert.doesNotMatch(payload.get("page"), /private-search|private-click-id/);
  assert.doesNotMatch(payload.get("referrer"), /private/);
  assert.match(payload.get("related_events"), /IMHomeShelves/);
  assert.match(payload.get("client"), /Instagram in-app browser 439\.0/);
  assert.match(payload.get("network"), /type=4g/);
});

test("fatal JavaScript errors include stack and location and show a reference", () => {
  const harness = createHarness();
  const error = new Error("Homepage exploded");
  error.stack = "Error: Homepage exploded\n    at script.js:40:3";
  harness.context.onerror(
    "Uncaught Error: Homepage exploded",
    "https://improvingmuslim.com/scripts/script.js?v=test",
    40,
    3,
    error,
  );
  harness.runTimers();

  assert.match(harness.main.innerHTML, /This page didn\u2019t load completely/);
  assert.match(harness.main.innerHTML, /Reference: IM-12345678/);
  assert.equal(harness.requests.length, 1);
  const payload = harness.requests[0].options.body;
  assert.equal(payload.get("severity"), "fatal");
  assert.equal(payload.get("line_column"), "40:3");
  assert.match(payload.get("stack"), /script\.js:40:3/);
  assert.equal(payload.get("incident"), "IM-12345678");
  assert.match(payload.get("fingerprint"), /^IMF-[0-9A-F]{8}$/);
});

test("the same incident fingerprint is suppressed within one page session", () => {
  const harness = createHarness();
  const report = () => {
    harness.context.IMErrorReporter.reportRecoverable("Repeated enhancement failure", {
      kind: "dependency",
      source: "https://improvingmuslim.com/scripts/optional.js",
    });
    harness.runTimers();
  };

  report();
  report();
  assert.equal(harness.requests.length, 1);
});

test("monitored pages load the reporter before every other script", () => {
  const pages = [
    "../index.html",
    "../pages/history.html",
    "../pages/saved.html",
    "../pages/watch.html",
  ];

  pages.forEach((relativePath) => {
    const html = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const reporterIndex = html.indexOf("scripts/error-handler.js?v=20260724-incident-reporting");
    const firstScriptIndex = html.indexOf("<script");
    assert.notEqual(reporterIndex, -1, `${relativePath} loads the error reporter`);
    assert.equal(firstScriptIndex, html.lastIndexOf("<script", reporterIndex));
  });
});
