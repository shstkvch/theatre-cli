import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadData } from "../src/api.js";

const shows = {
  apiVersion: "1.1",
  generatedAt: "2026-10-18T09:00:00Z",
  refreshedAt: "2026-10-18T08:55:00Z",
  shows: [{ id: "lune", title: "Lune" }],
};
const venues = {
  apiVersion: "1.1",
  generatedAt: "2026-10-18T09:00:00Z",
  refreshedAt: "2026-10-18T08:55:00Z",
  venues: [{ id: "oran-mor", name: "A Play, a Pie and a Pint" }],
};

function response(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...options.headers },
  });
}

function mockFetch(calls, { notModified = false } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    if (notModified) return new Response(null, { status: 304 });
    if (url.endsWith("/shows.json")) {
      return response(shows, { headers: { etag: '"shows-1"' } });
    }
    return response(venues, { headers: { etag: '"venues-1"' } });
  };
}

async function withCache(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "theatre-cli-test-"));
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = directory;
  t.after(async () => {
    if (previous == null) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test("the first load fetches shows and venues and caches them", async (t) => {
  await withCache(t);
  const calls = [];
  const data = await loadData({
    fetchImpl: mockFetch(calls),
    now: () => 1_000,
  });
  assert.equal(calls.length, 2);
  assert.equal(data.shows[0].id, "lune");
  assert.equal(data.venues[0].id, "oran-mor");
  assert.equal(data.venueMap.get("oran-mor").name, "A Play, a Pie and a Pint");
  assert.equal(data.source.apiVersion, "1.1");
  assert.equal(data.stale, false);
});

test("a fresh cache is used without touching the network", async (t) => {
  await withCache(t);
  await loadData({ fetchImpl: mockFetch([]), now: () => 1_000 });
  const calls = [];
  const data = await loadData({
    fetchImpl: mockFetch(calls),
    now: () => 2_000,
  });
  assert.equal(calls.length, 0);
  assert.equal(data.shows[0].id, "lune");
  assert.equal(data.stale, false);
});

test("a refresh revalidates with If-None-Match and can take a 304", async (t) => {
  await withCache(t);
  await loadData({ fetchImpl: mockFetch([]), now: () => 1_000 });
  const calls = [];
  const data = await loadData({
    fetchImpl: mockFetch(calls, { notModified: true }),
    refresh: true,
    now: () => 2_000,
  });
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((call) => call.options.headers["If-None-Match"]),
  );
  assert.equal(data.shows[0].id, "lune");
  assert.equal(data.stale, false);
});

test("an expired cache is revalidated", async (t) => {
  await withCache(t);
  await loadData({ fetchImpl: mockFetch([]), now: () => 1_000, ttl: 100 });
  const calls = [];
  await loadData({
    fetchImpl: mockFetch(calls),
    now: () => 1_200,
    ttl: 100,
  });
  assert.equal(calls.length, 2);
});

test("a network failure falls back to the last good cache", async (t) => {
  await withCache(t);
  await loadData({ fetchImpl: mockFetch([]), now: () => 1_000 });
  const data = await loadData({
    fetchImpl: async () => {
      throw new Error("offline");
    },
    refresh: true,
    now: () => 2_000,
  });
  assert.equal(data.stale, true);
  assert.equal(data.shows[0].id, "lune");
  assert.equal(data.error.message, "offline");
});

test("with no cache, a network failure is reported rather than hidden", async (t) => {
  await withCache(t);
  await assert.rejects(
    loadData({
      fetchImpl: async () => {
        throw new Error("offline");
      },
      now: () => 1_000,
    }),
    /offline/,
  );
});
