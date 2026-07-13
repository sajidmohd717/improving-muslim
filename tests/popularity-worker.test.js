import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/popularity-worker.js";

const ORIGIN = "https://improvingmuslim.com";

function createEnvironment() {
  const values = new Map();

  return {
    env: {
      ALLOWED_ORIGIN: ORIGIN,
      POPULARITY: {
        async get(key) {
          return values.has(key) ? JSON.parse(values.get(key)) : null;
        },
        async list({ prefix = "", limit } = {}) {
          const keys = Array.from(values.keys())
            .filter((key) => key.startsWith(prefix))
            .slice(0, limit || Infinity)
            .map((name) => ({ name }));
          return { keys, list_complete: true };
        },
        async put(key, value) {
          values.set(key, value);
        },
      },
    },
    ctx: {},
  };
}

function request(path, options = {}) {
  return new Request(`https://popularity.example${path}`, {
    ...options,
    headers: { Origin: ORIGIN, ...(options.headers || {}) },
  });
}

test("health confirms the Worker and KV binding", async () => {
  const { env, ctx } = createEnvironment();
  const response = await worker.fetch(request("/health"), env, ctx);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "popularity" });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("play and completion events appear in the popularity response", async () => {
  const { env, ctx } = createEnvironment();
  const key = "video:purpose-of-creation";

  for (const event of ["play", "play", "complete"]) {
    const response = await worker.fetch(request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, event }),
    }), env, ctx);
    assert.equal(response.status, 204);
  }

  const response = await worker.fetch(request("/popular"), env, ctx);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: { [key]: { p: 2, c: 1 } } });
});

test("invalid events and unapproved origins are rejected", async () => {
  const { env, ctx } = createEnvironment();
  const invalidEvent = await worker.fetch(request("/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "not-a-catalog-key", event: "play" }),
  }), env, ctx);
  assert.equal(invalidEvent.status, 400);

  const wrongOrigin = new Request("https://popularity.example/popular", {
    headers: { Origin: "https://example.com" },
  });
  const forbidden = await worker.fetch(wrongOrigin, env, ctx);
  assert.equal(forbidden.status, 403);
});
