import {
  formatDayHeader,
  formatLongDate,
  formatRuns,
  formatShortDate,
  formatShowRun,
} from "./dates.js";
import { venueColours } from "./fallback-colours.js";

export function truncate(text, width) {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width === 1) return "…";
  const cut = text.slice(0, width - 1);
  const space = cut.lastIndexOf(" ");
  if (space > width * 0.55) return `${cut.slice(0, space)}…`;
  return `${cut.trimEnd()}…`;
}

export function formatTime(value) {
  if (!value) return "TBC";
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "am" : "pm";
  const hour = hours % 12 || 12;
  return `${hour}:${minutes}${suffix}`;
}

export function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? `£${number}` : `£${number.toFixed(2)}`;
}

export function priceLabel(occurrence, { fromPrefix = true } = {}) {
  if (occurrence.price != null) return money(occurrence.price);
  const pricing = occurrence.show.pricing;
  if (!pricing) return "—";
  if (pricing.free) return "free";
  if (pricing.payWhatYouLike) return "PWYL";
  if (pricing.from == null) return "—";
  return fromPrefix ? `from ${money(pricing.from)}` : money(pricing.from);
}

function venuePill(venue, width, painter) {
  const palette = venueColours(venue);
  const text = truncate(venue.name, width).padEnd(width);
  return palette ? painter.pill(text, palette.colour, palette.ink) : text;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function agendaWidths(occurrences, totalWidth) {
  const timeWidth = 7;
  const priceWidth = Math.max(
    5,
    ...occurrences.map((occurrence) => priceLabel(occurrence).length),
  );
  const venueNames = occurrences.map((occurrence) => occurrence.show.venue.name);
  const venueWidth = Math.min(
    24,
    Math.max(16, ...venueNames.map((name) => name.length)),
  );
  const maxTitle = Math.max(
    16,
    ...occurrences.map((occurrence) => occurrence.show.title.length),
  );
  const fixed = 15 + venueWidth + priceWidth;
  const titleWidth = Math.max(
    16,
    Math.min(maxTitle, totalWidth - fixed),
  );
  return { timeWidth, priceWidth, venueWidth, titleWidth };
}

export function renderAgenda({
  dates,
  occurrences,
  today,
  label,
  painter,
  width,
  venueFor,
}) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    if (!groups.has(occurrence.date)) groups.set(occurrence.date, []);
    groups.get(occurrence.date).push(occurrence);
  }

  const { timeWidth, priceWidth, venueWidth, titleWidth } = agendaWidths(
    occurrences,
    width,
  );
  const lines = [`${painter.bold("Glasgow Theatre")} · ${label}`, ""];

  dates.forEach((date, index) => {
    if (index > 0) lines.push("");
    const rows = groups.get(date) || [];
    const meta = [
      date === today ? "TODAY" : null,
      String(rows.length),
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`${painter.bold(formatDayHeader(date))}${painter.dim(` · ${meta}`)}`);

    if (!rows.length) {
      lines.push(painter.dim("  Nothing listed."));
      return;
    }

    for (const occurrence of rows) {
      const time = `${formatTime(occurrence.time)}${occurrence.runOnly ? "*" : ""}`;
      const title = truncate(occurrence.show.title, titleWidth);
      const venue = venuePill(
        venueFor(occurrence.show),
        venueWidth,
        painter,
      );
      const price = priceLabel(occurrence);
      lines.push(
        `  ${painter.cyan(time.padStart(timeWidth))}  ${painter.bold(title.padEnd(titleWidth))}  ${venue}  ${painter.dim(price.padStart(priceWidth))}`,
      );
    }
  });

  const notes = [];
  if (occurrences.some((occurrence) => occurrence.runOnly)) {
    notes.push("* in season, but this venue publishes no nightly schedule");
  }
  if (occurrences.some((occurrence) => occurrence.time == null)) {
    notes.push("TBC = the venue has not published a time");
  }
  if (notes.length) {
    lines.push("");
    lines.push(painter.dim(notes.join(" · ")));
  }

  const showCount = new Set(occurrences.map((occurrence) => occurrence.show.id))
    .size;
  const venueCount = new Set(
    occurrences.map((occurrence) => occurrence.show.venue.id),
  ).size;
  lines.push("");
  lines.push(
    painter.dim(
      `${countLabel(occurrences.length, "performance")} · ${countLabel(showCount, "show")} · ${countLabel(venueCount, "venue")} · glasgowtheatre.com`,
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function renderMonth({ runs, label, today, painter, width, venueFor }) {
  const opensWidth = 10;
  const runsWidth = 13;
  const priceWidth = 7;
  const venueWidth = Math.min(
    24,
    Math.max(
      16,
      ...runs.map(({ show }) => show.venue.name.length),
    ),
  );
  const fixed = 38 + venueWidth;
  const maxTitle = Math.max(
    16,
    ...runs.map(({ show }) => show.title.length),
  );
  const titleWidth = Math.max(16, Math.min(maxTitle, width - fixed));

  const header = `${"OPENS".padEnd(opensWidth)}  ${"SHOW".padEnd(titleWidth)}  ${"VENUE".padEnd(venueWidth)}  ${"RUNS".padEnd(runsWidth)}${"FROM".padStart(priceWidth)}`;
  const lines = [
    `${painter.bold("Glasgow Theatre")} · ${label}`,
    "",
    painter.dim(header),
  ];

  for (const { show, firstDate } of runs) {
    const venue = venuePill(venueFor(show), venueWidth, painter);
    const price = priceLabel(
      { show, price: null },
      { fromPrefix: false },
    );
    lines.push(
      `${formatShortDate(firstDate).padEnd(opensWidth)}  ${painter.bold(truncate(show.title, titleWidth).padEnd(titleWidth))}  ${venue}  ${formatRuns(show, today).padEnd(runsWidth)}${painter.dim(price.padStart(priceWidth))}`,
    );
  }

  const venueCount = new Set(runs.map(({ show }) => show.venue.id)).size;
  lines.push("");
  lines.push(
    painter.dim(
      `${countLabel(runs.length, "show")} · ${countLabel(venueCount, "venue")} · glasgowtheatre.com`,
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function renderVenues({ venues, painter }) {
  const idWidth = Math.max(
    12,
    ...venues.map((venue) => venue.id.length),
  );
  const venueWidth = Math.min(
    28,
    Math.max(18, ...venues.map((venue) => venue.name.length)),
  );
  const areaWidth = 16;
  const upcomingWidth = 8;
  const header = `${"ID".padEnd(idWidth)}  ${"VENUE".padEnd(venueWidth)}  ${"AREA".padEnd(areaWidth)}${"UPCOMING".padStart(upcomingWidth)}`;
  const lines = [
    painter.bold("Glasgow Theatre venues"),
    "",
    painter.dim(header),
  ];

  for (const venue of [...venues].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(
      `${venue.id.padEnd(idWidth)}  ${venuePill(venue, venueWidth, painter)}  ${truncate(venue.area || "", areaWidth).padEnd(areaWidth)}${String(venue.upcomingShows ?? "").padStart(upcomingWidth)}`,
    );
  }

  lines.push("");
  lines.push(
    painter.dim(
      `${countLabel(venues.length, "venue")} · glasgowtheatre.com`,
    ),
  );
  return `${lines.join("\n")}\n`;
}

function wrap(text, width) {
  const paragraphs = String(text || "").split(/\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += ` ${word}`;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function renderShow({ show, venue, painter, width }) {
  const lines = [painter.bold(show.title)];
  const meta = [venue?.name || show.venue.name, venue?.area || show.venue.area, show.artForm]
    .filter(Boolean)
    .join(" · ");
  if (venue) {
    const palette = venueColours(venue);
    const name = palette
      ? painter.pill(venue.name, palette.colour, palette.ink)
      : venue.name;
    lines.push(
      `${name}${painter.dim(` · ${[venue.area, show.artForm].filter(Boolean).join(" · ")}`)}`,
    );
  } else {
    lines.push(painter.dim(meta));
  }
  lines.push("");
  lines.push(painter.bold(formatShowRun(show)));
  lines.push("");

  if (show.performances?.length) {
    const dateWidth = 12;
    const timeWidth = 8;
    const priceWidth = 8;
    lines.push(
      painter.dim(
        `${"DATE".padEnd(dateWidth)}  ${"TIME".padEnd(timeWidth)}${"PRICE".padStart(priceWidth)}`,
      ),
    );
    for (const performance of show.performances) {
      lines.push(
        `${formatShortDate(performance.date).padEnd(dateWidth)}  ${formatTime(performance.time).padEnd(timeWidth)}${(performance.price != null ? money(performance.price) : "").padStart(priceWidth)}`,
      );
    }
  } else {
    lines.push(`Time: ${formatTime(show.run.time)}`);
    if (show.schedule?.text) {
      lines.push("Schedule:");
      for (const line of wrap(show.schedule.text, Math.min(84, width))) {
        lines.push(`  ${line}`);
      }
    }
  }

  if (show.pricing) {
    lines.push("");
    if (show.pricing.free) {
      lines.push(`Prices: ${painter.green("free")}`);
    } else if (show.pricing.payWhatYouLike) {
      lines.push("Prices: pay what you like");
    } else if (show.pricing.text) {
      lines.push("Prices:");
      for (const line of wrap(show.pricing.text, Math.min(84, width))) {
        lines.push(`  ${line}`);
      }
    } else if (show.pricing.from != null) {
      lines.push(`Prices: from ${money(show.pricing.from)}`);
    }
  }

  if (show.durationMinutes) {
    lines.push(`Duration: ${show.durationMinutes} minutes`);
  }
  if (show.accessibility) {
    lines.push(`Access: ${show.accessibility}`);
  }

  if (show.bookingUrl) lines.push(`Booking: ${show.bookingUrl}`);
  if (show.url) lines.push(`Details: ${show.url}`);

  if (show.description) {
    lines.push("");
    for (const line of wrap(show.description, Math.min(88, width))) {
      lines.push(line);
    }
  }

  lines.push("");
  lines.push(painter.dim("Listings from glasgowtheatre.com · always confirm with the venue"));
  return `${lines.join("\n")}\n`;
}

export function renderEmpty({ label, period, painter, filtered }) {
  const lines = [
    `${painter.bold("Glasgow Theatre")} · ${label}`,
    "",
    filtered
      ? "  Nothing matches those filters."
      : `  Nothing listed ${period}.`,
    "",
    painter.dim("  Try: theatre week · theatre month · theatre venues"),
  ];
  return `${lines.join("\n")}\n`;
}

export const HELP = `theatre — what's on in Glasgow's theatres

Usage
  theatre [today]              What's on today
  theatre week                 The next seven days
  theatre month                The next thirty days
  theatre on <date>            A specific day
  theatre show <id>            One show, with every performance
  theatre venues               Venue ids, areas and colours

Options
  --venue <id|name>   Only this venue; repeat or comma-separate
  --area <area>       Only this area, e.g. "West End"
  --form <form>       Only this art form, e.g. play, musical, dance
  --tag <tag>         Only shows with this tag, e.g. lunchtime
  --free              Only free shows
  --pwyl              Only pay-what-you-like shows
  --under <price>     Only shows from this price or less
  --q <text>          Search titles, venues and descriptions
  --json              Machine-readable output
  --plain             No colour
  --wide              Do not truncate long titles
  --refresh           Ignore the ten-minute cache
  -h, --help          This help
  -V, --version       Version

Dates
  2026-10-22, "22 oct", "22/10", today, tomorrow, fri

Data from glasgowtheatre.com, free to use with attribution.
`;
