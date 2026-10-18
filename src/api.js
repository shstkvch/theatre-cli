import { readCache, writeCache } from "./cache.js";
import { VERSION } from "./version.js";

const DEFAULT_ROOT = "https://glasgowtheatre.com/api/v1";
const TTL_MS = 10 * 60 * 1000;
const USER_AGENT = `theatre-cli/${VERSION} (+https://github.com/shstkvch/theatre-cli)`;

export function apiRoot() {
  return (process.env.THEATRE_API_ROOT || DEFAULT_ROOT).replace(/\/$/, "");
}

async function fetchResource({
  name,
  url,
  refresh,
  fetchImpl,
  now,
  ttl,
  timeout,
}) {
  const cached = await readCache(name);
  const fresh = cached && now() - cached.fetchedAt < ttl;
  if (cached && !refresh && fresh) {
    return { ...cached, stale: false, fromCache: true };
  }

  const headers = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;

  try {
    const response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(timeout),
    });

    if (response.status === 304 && cached) {
      const value = { ...cached, fetchedAt: now() };
      await writeCache(name, value);
      return { ...value, stale: false, fromCache: true };
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const data = await response.json();
    const value = {
      fetchedAt: now(),
      etag: response.headers?.get?.("etag") || null,
      data,
    };
    await writeCache(name, value);
    return { ...value, stale: false, fromCache: false };
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        stale: true,
        fromCache: true,
        error,
      };
    }
    const reason =
      error?.name === "TimeoutError" ? "request timed out" : error.message;
    throw new Error(
      `Could not load ${url} (${reason}). Check your connection and try again.`,
      { cause: error },
    );
  }
}

function validateShows(data) {
  if (!data || !Array.isArray(data.shows)) {
    throw new Error("the shows API returned an unexpected shape");
  }
  return data;
}

function validateVenues(data) {
  if (!data || !Array.isArray(data.venues)) {
    throw new Error("the venues API returned an unexpected shape");
  }
  return data;
}

/**
 * Fetch and cache the two snapshots the CLI needs. A network failure falls
 * back to the last successful copy, marked `stale`, so the tool still works
 * on a train.
 */
export async function loadData({
  refresh = false,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  ttl = TTL_MS,
  timeout = 15_000,
  root = apiRoot(),
} = {}) {
  const [shows, venues] = await Promise.all([
    fetchResource({
      name: "shows",
      url: `${root}/shows.json`,
      refresh,
      fetchImpl,
      now,
      ttl,
      timeout,
    }),
    fetchResource({
      name: "venues",
      url: `${root}/venues.json`,
      refresh,
      fetchImpl,
      now,
      ttl,
      timeout,
    }),
  ]);

  const showsData = validateShows(shows.data);
  const venuesData = validateVenues(venues.data);
  const stale = shows.stale || venues.stale;
  const fetchedAt = Math.min(shows.fetchedAt, venues.fetchedAt);

  return {
    shows: showsData.shows,
    venues: venuesData.venues,
    venueMap: new Map(venuesData.venues.map((venue) => [venue.id, venue])),
    source: {
      apiVersion: showsData.apiVersion || venuesData.apiVersion || null,
      generatedAt: showsData.generatedAt || venuesData.generatedAt || null,
      refreshedAt: showsData.refreshedAt || venuesData.refreshedAt || null,
    },
    stale,
    fetchedAt,
    error: shows.error || venues.error || null,
  };
}
