/**
 * A local copy of Glasgow Theatre's house palette, used when the API predates
 * the `colour`/`ink` fields or a cached venue list is older than this CLI.
 * The API is authoritative: as soon as it publishes colours, those win.
 *
 * Mirrors functions/_lib/venue-colours.js in shstkvch/glasgowtheatre-com.
 */
export const FALLBACK_VENUE_COLOURS = {
  citizens: { colour: "#111111", ink: "#ffffff" },
  tron: { colour: "#e01c70", ink: "#ffffff" },
  tramway: { colour: "#4a4f57", ink: "#ffffff" },
  "oran-mor": { colour: "#d54222", ink: "#ffffff" },
  "glad-cafe": { colour: "#f0bd0f", ink: "#20202c" },
  platform: { colour: "#6626ff", ink: "#ffffff" },
  "southside-fringe": { colour: "#0051c3", ink: "#ffffff" },
  cottiers: { colour: "#314e42", ink: "#ffffff" },
  kings: { colour: "#5a00ff", ink: "#ffffff" },
  "theatre-royal": { colour: "#d0202d", ink: "#ffffff" },
  pavilion: { colour: "#256d58", ink: "#ffffff" },
  "old-hairdressers": { colour: "#6d7c39", ink: "#ffffff" },
  "theatre-118": { colour: "#ff5b1e", ink: "#20202c" },
  mono: { colour: "#0e7c8c", ink: "#ffffff" },
};

export function venueColours(venue) {
  if (venue && venue.colour && venue.ink) {
    return { colour: venue.colour, ink: venue.ink };
  }
  return FALLBACK_VENUE_COLOURS[venue?.id] || null;
}
