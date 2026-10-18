import { parseArgs } from "node:util";
import { loadData } from "./api.js";
import {
  addDays,
  formatDateRange,
  formatLongDate,
  formatMonthRange,
  parseDateArg,
  todayInLondon,
} from "./dates.js";
import { UsageError } from "./errors.js";
import {
  createPainter,
  colourEnabled,
  colourMode,
} from "./colour.js";
import {
  filterShows,
  resolveVenues,
  splitList,
} from "./filters.js";
import {
  buildOccurrences,
  buildRuns,
  datesByShow,
} from "./occurrences.js";
import {
  HELP,
  renderAgenda,
  renderEmpty,
  renderMonth,
  renderShow,
  renderVenues,
} from "./format.js";
import { VERSION } from "./version.js";

const OPTIONS = {
  venue: { type: "string", multiple: true },
  form: { type: "string", multiple: true },
  tag: { type: "string", multiple: true },
  area: { type: "string", multiple: true },
  free: { type: "boolean" },
  pwyl: { type: "boolean" },
  under: { type: "string" },
  q: { type: "string" },
  json: { type: "boolean" },
  plain: { type: "boolean" },
  wide: { type: "boolean" },
  refresh: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "V" },
};

const COMMANDS = new Set([
  "today",
  "week",
  "month",
  "on",
  "show",
  "venues",
  "help",
]);

function parseUnder(value) {
  if (value == null) return null;
  const number = Number(String(value).replace(/^£/, ""));
  if (!Number.isFinite(number) || number < 0) {
    throw new UsageError(
      `Couldn't read "${value}" as a price.`,
      "Try --under 20 or --under 14.50.",
    );
  }
  return number;
}

function filterOptions(values) {
  return {
    venue: values.venue || [],
    form: values.form || [],
    tag: values.tag || [],
    area: values.area || [],
    free: Boolean(values.free),
    pwyl: Boolean(values.pwyl),
    under: parseUnder(values.under),
    q: values.q || "",
  };
}

function hasFilters(options) {
  return Boolean(
    options.venue.length ||
      options.form.length ||
      options.tag.length ||
      options.area.length ||
      options.free ||
      options.pwyl ||
      options.under != null ||
      options.q.trim(),
  );
}

function cacheTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function findShow(shows, token) {
  const wanted = token.toLowerCase();
  const exact = shows.find((show) => show.id.toLowerCase() === wanted);
  if (exact) return { show: exact };
  const matches = shows.filter(
    (show) =>
      show.id.toLowerCase().includes(wanted) ||
      show.title.toLowerCase().includes(wanted),
  );
  if (matches.length === 1) return { show: matches[0] };
  return { matches };
}

function showCandidates(matches, token) {
  const lines = [`${matches.length} shows match "${token}":`, ""];
  for (const show of matches.slice(0, 20)) {
    lines.push(`  ${show.id}  ${show.title} — ${show.venue.name}`);
  }
  if (matches.length > 20) lines.push(`  … and ${matches.length - 20} more`);
  lines.push("", "Use the id with 'theatre show <id>'.");
  return `${lines.join("\n")}\n`;
}

function jsonEnvelope({ command, from, to, source, shows, occurrences }) {
  const byShow = datesByShow(occurrences);
  const inRange = shows.filter((show) => byShow.has(show.id));
  return {
    command,
    from,
    to,
    source,
    count: inRange.length,
    shows: inRange.map((show) => ({
      ...show,
      dates: byShow.get(show.id) || [],
    })),
  };
}

export async function main(args = []) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(error.message);
  }

  const { values, positionals } = parsed;
  if (values.help || positionals[0] === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const today = todayInLondon();
  let [command, ...rest] = positionals;
  if (!command) command = "today";
  let argument = rest.join(" ").trim();

  if (!COMMANDS.has(command)) {
    const candidate = [command, ...rest].join(" ");
    try {
      argument = parseDateArg(candidate, today);
      command = "on";
      rest = [];
    } catch {
      throw new UsageError(
        `Unknown command "${command}".`,
        "Try today, week, month, on <date>, show <id> or venues.",
      );
    }
  }

  if (command !== "on" && command !== "show" && rest.length) {
    throw new UsageError(`Unexpected argument "${rest[0]}".`);
  }

  if (command === "on" && !argument) {
    throw new UsageError(
      "Which date?",
      'Try \'theatre on 22 oct\' or \'theatre on 2026-10-22\'.',
    );
  }
  if (command === "show" && !argument) {
    throw new UsageError(
      "Which show?",
      "Try 'theatre show lune' or 'theatre show oran-mor-lune'.",
    );
  }

  let from;
  let to;
  let label;
  let period;
  if (command === "today") {
    from = to = today;
    label = formatLongDate(today);
    period = "today";
  } else if (command === "on") {
    from = to = parseDateArg(argument, today);
    label = formatLongDate(from);
    period = `on ${label}`;
  } else if (command === "week") {
    from = today;
    to = addDays(today, 6);
    label = formatDateRange(from, to);
    period = "in the next seven days";
  } else if (command === "month") {
    from = today;
    to = addDays(today, 29);
    label = formatMonthRange(from, to);
    period = "in the next thirty days";
  }

  const data = await loadData({ refresh: Boolean(values.refresh) });
  if (data.stale) {
    console.error(
      `theatre: network unavailable; using cached listings from ${cacheTime(data.fetchedAt)}`,
    );
  }

  const painter = createPainter({
    enabled:
      !values.plain && !values.json && colourEnabled(process.stdout),
    mode: colourMode(),
  });
  const venueFor = (show) => data.venueMap.get(show.venue.id) || show.venue;

  if (command === "venues") {
    if (values.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: "venues",
            source: data.source,
            count: data.venues.length,
            venues: data.venues,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    process.stdout.write(
      renderVenues({ venues: data.venues, painter }),
    );
    return;
  }

  if (command === "show") {
    const found = findShow(data.shows, argument);
    if (!found.show) {
      if (!found.matches?.length) {
        throw new UsageError(
          `No show matching "${argument}".`,
          "Try 'theatre week' or 'theatre month'.",
        );
      }
      process.stdout.write(showCandidates(found.matches, argument));
      return;
    }
    if (values.json) {
      process.stdout.write(
        `${JSON.stringify(
          { command: "show", source: data.source, show: found.show },
          null,
          2,
        )}\n`,
      );
      return;
    }
    process.stdout.write(
      renderShow({
        show: found.show,
        venue: venueFor(found.show),
        painter,
        width: process.stdout.columns || 100,
      }),
    );
    return;
  }

  const options = filterOptions(values);
  const venueIds = resolveVenues(
    splitList(options.venue),
    data.venues,
  );
  const filtered = filterShows(data.shows, options, venueIds);
  const occurrences = buildOccurrences(filtered, from, to);

  if (values.json) {
    process.stdout.write(
      `${JSON.stringify(
        jsonEnvelope({
          command,
          from,
          to,
          source: data.source,
          shows: filtered,
          occurrences,
        }),
        null,
        2,
      )}\n`,
    );
    return;
  }

  const width = values.wide
    ? 1000
    : Number(process.env.THEATRE_WIDTH) || process.stdout.columns || 100;

  if (command === "month") {
    const runs = buildRuns(filtered, from, to);
    if (!runs.length) {
      process.stdout.write(
        renderEmpty({
          label,
          period,
          painter,
          filtered: hasFilters(options),
        }),
      );
      return;
    }
    process.stdout.write(
      renderMonth({ runs, label, today, painter, width, venueFor }),
    );
    return;
  }

  if (!occurrences.length || !filtered.length) {
    process.stdout.write(
      renderEmpty({
        label,
        period,
        painter,
        filtered: hasFilters(options),
      }),
    );
    return;
  }

  const dates = command === "week"
    ? Array.from({ length: 7 }, (_, index) => addDays(from, index))
    : [from];

  process.stdout.write(
    renderAgenda({
      dates,
      occurrences,
      today,
      label,
      painter,
      width,
      venueFor,
      wide: Boolean(values.wide),
    }),
  );
}
