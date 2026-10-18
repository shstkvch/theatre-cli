import { UsageError } from "./errors.js";

export const normalise = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const VENUE_ALIASES = {
  citz: "citizens",
  cit: "citizens",
  ppp: "oran-mor",
  apo: "oran-mor",
  app: "oran-mor",
  oran: "oran-mor",
  playpiepint: "oran-mor",
  "play pie pint": "oran-mor",
  "a-play-a-pie-and-a-pint": "oran-mor",
  royal: "theatre-royal",
  "118": "theatre-118",
  hairdressers: "old-hairdressers",
  glad: "glad-cafe",
  fringe: "southside-fringe",
};

export function splitList(values = []) {
  return values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveVenues(tokens, venues) {
  if (!tokens.length) return null;
  const ids = new Set();
  for (const token of tokens) {
    const wanted = normalise(token);
    const aliased = VENUE_ALIASES[wanted];
    const exactId = venues.find((venue) => normalise(venue.id) === wanted);
    const exactName = venues.find((venue) => normalise(venue.name) === wanted);
    const partial = venues.filter(
      (venue) => wanted.length >= 3 && normalise(venue.name).includes(wanted),
    );

    const match = aliased
      ? venues.find((venue) => venue.id === aliased)
      : exactId || exactName || (partial.length === 1 ? partial[0] : null);

    if (!match) {
      const options = venues.map((venue) => venue.id).sort();
      throw new UsageError(
        `Unknown venue "${token}".`,
        `Venue ids: ${options.join(", ")}.`,
      );
    }
    ids.add(match.id);
  }
  return ids;
}

export function availableForms(shows) {
  return [...new Set(shows.map((show) => show.artForm).filter(Boolean))].sort();
}

export function availableAreas(shows) {
  return [
    ...new Set(shows.map((show) => show.venue.area).filter(Boolean)),
  ].sort();
}

function haystack(show) {
  return [
    show.title,
    show.venue.name,
    show.venue.area,
    show.description,
    show.producer,
    show.artForm,
    ...(show.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterShows(shows, options, venueIds) {
  const forms = new Set(splitList(options.form).map((form) => form.toLowerCase()));
  const tags = new Set(splitList(options.tag).map((tag) => tag.toLowerCase()));
  const areas = new Set(splitList(options.area).map(normalise));
  const query = options.q?.trim().toLowerCase() || null;

  if (forms.size) {
    const valid = new Set(availableForms(shows));
    const unknown = [...forms].filter((form) => !valid.has(form));
    if (unknown.length) {
      throw new UsageError(
        `Unknown art form${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`,
        `Art forms: ${[...valid].join(", ")}.`,
      );
    }
  }

  if (areas.size) {
    const valid = new Set(availableAreas(shows).map(normalise));
    const unknown = [...areas].filter((area) => !valid.has(area));
    if (unknown.length) {
      throw new UsageError(
        `Unknown area${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`,
        `Areas: ${availableAreas(shows).join(", ")}.`,
      );
    }
  }

  return shows.filter((show) => {
    if (venueIds && !venueIds.has(show.venue.id)) return false;
    if (forms.size && !forms.has(String(show.artForm || "").toLowerCase())) {
      return false;
    }
    if (
      tags.size &&
      !(show.tags || []).some((tag) => tags.has(tag.toLowerCase()))
    ) {
      return false;
    }
    if (areas.size && !areas.has(normalise(show.venue.area))) return false;
    if (options.free) {
      const free = Boolean(
        show.pricing && (show.pricing.free || show.pricing.from === 0),
      );
      if (!free) return false;
    }
    if (options.pwyl && !show.pricing?.payWhatYouLike) return false;
    if (options.under != null) {
      if (show.pricing?.from == null || show.pricing.from > options.under) {
        return false;
      }
    }
    if (query && !haystack(show).includes(query)) return false;
    return true;
  });
}
