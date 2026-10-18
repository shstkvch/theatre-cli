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

function agendaWidths(occurrences, totalWidth, { compact = false } = {}) {
  const timeWidth = 7;
  const priceWidth = Math.max(
    5,
    ...occurrences.map((occurrence) => priceLabel(occurrence).length),
  );
  const venueNames = occurrences.map((occurrence) => occurrence.show.venue.name);
  const venueWidth = Math.min(
    compact ? 16 : 24,
    Math.max(16, ...venueNames.map((name) => name.length)),
  );
  const maxTitle = Math.max(
    16,
    ...occurrences.map((occurrence) => occurrence.show.title.length),
  );
  const titleCap = compact ? 40 : Number.POSITIVE_INFINITY;
  const fixed = 15 + venueWidth + priceWidth;
  const titleWidth = Math.max(
    16,
    Math.min(maxTitle, titleCap, totalWidth - fixed),
  );
  return { timeWidth, priceWidth, venueWidth, titleWidth };
}

const ANSI = /\x1b\[[0-9;]*m/g;
const visibleLength = (text) => text.replace(ANSI, "").length;
const padVisible = (text, width) =>
  `${text}${" ".repeat(Math.max(0, width - visibleLength(text)))}`;

function dayBlock({ date, rows, today, painter, widths, venueFor }) {
  const { timeWidth, priceWidth, venueWidth, titleWidth } = widths;
  const meta = [date === today ? "TODAY" : null, String(rows.length)]
    .filter(Boolean)
    .join(" · ");
  const lines = [
    `${painter.bold(formatDayHeader(date))}${painter.dim(` · ${meta}`)}`,
  ];

  if (!rows.length) {
    lines.push(painter.dim("  Nothing listed."));
    return lines;
  }

  for (const occurrence of rows) {
    const time = `${formatTime(occurrence.time)}${occurrence.runOnly ? "*" : ""}`;
    const title = truncate(occurrence.show.title, titleWidth);
    const venue = venuePill(venueFor(occurrence.show), venueWidth, painter);
    const price = priceLabel(occurrence);
    lines.push(
      `  ${painter.cyan(time.padStart(timeWidth))}  ${painter.bold(title.padEnd(titleWidth))}  ${venue}  ${painter.dim(price.padStart(priceWidth))}`,
    );
  }
  return lines;
}

function stackBlocks(blocks) {
  const lines = [];
  for (const block of blocks) {
    if (lines.length) lines.push("");
    lines.push(...block);
  }
  return lines;
}

/** Split a week where the two columns end up roughly the same height. */
function balancedSplit(blocks) {
  if (blocks.length < 2) return blocks.length;
  const heights = blocks.map((block) => block.length + 1);
  const total = heights.reduce((sum, height) => sum + height, 0);
  let best = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  let left = 0;
  for (let index = 1; index < blocks.length; index += 1) {
    left += heights[index - 1];
    const difference = Math.abs(left - (total - left));
    if (difference < bestDifference) {
      bestDifference = difference;
      best = index;
    }
  }
  return best;
}

export function renderAgenda({
  dates,
  occurrences,
  today,
  label,
  painter,
  width,
  venueFor,
  wide = false,
}) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    if (!groups.has(occurrence.date)) groups.set(occurrence.date, []);
    groups.get(occurrence.date).push(occurrence);
  }

  const fullWidths = agendaWidths(occurrences, width);
  const blocks = dates.map((date) =>
    dayBlock({
      date,
      rows: groups.get(date) || [],
      today,
      painter,
      widths: fullWidths,
      venueFor,
    }),
  );

  let body = stackBlocks(blocks);

  // On a wide terminal, read the week as two newspaper columns. The column
  // width is capped so a very wide window does not leave two sparse islands.
  const half = Math.floor((width - 3) / 2);
  const columnWidth = Math.min(half, 90);
  const compactWidths = agendaWidths(occurrences, columnWidth, {
    compact: true,
  });
  const needed =
    15 +
    compactWidths.titleWidth +
    compactWidths.venueWidth +
    compactWidths.priceWidth;
  if (!wide && dates.length > 1 && columnWidth >= 64 && needed <= columnWidth) {
    const split = balancedSplit(blocks);
    const left = stackBlocks(
      dates.slice(0, split).map((date) =>
        dayBlock({
          date,
          rows: groups.get(date) || [],
          today,
          painter,
          widths: compactWidths,
          venueFor,
        }),
      ),
    );
    const right = stackBlocks(
      dates.slice(split).map((date) =>
        dayBlock({
          date,
          rows: groups.get(date) || [],
          today,
          painter,
          widths: compactWidths,
          venueFor,
        }),
      ),
    );
    const gutter = painter.dim(" │ ");
    const max = Math.max(left.length, right.length);
    body = [];
    for (let index = 0; index < max; index += 1) {
      const leftLine = left[index] || "";
      const rightLine = right[index] || "";
      body.push(
        `${padVisible(leftLine, columnWidth)}${gutter}${rightLine}`.trimEnd(),
      );
    }
  }

  const lines = [`${painter.bold("Glasgow Theatre")} · ${label}`, "", ...body];

  const notes = [];
  if (occurrences.some((occurrence) => occurrence.runOnly)) {
    notes.push("* in season, but this venue publishes no nightly schedule");
  }
  if (occurrences.some((occurrence) => occurrence.time == null)) {
    notes.push("TBC = the venue has not published a time");
  }
  if (occurrences.some((occurrence) => priceLabel(occurrence) === "—")) {
    notes.push("— = the venue has not published a price");
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

const dayMonth = (iso) => formatShortDate(iso).split(" ").slice(1).join(" ");

/** A shorter when-label for the two-column month: still tells you the date. */
function compactWhen(show, today) {
  const { opens, closes } = show.run;
  if (opens === closes) return formatShortDate(opens);
  if (opens < today) return `until ${dayMonth(closes)}`;
  if (opens.slice(0, 7) === closes.slice(0, 7)) {
    return `${Number(opens.slice(8, 10))}–${dayMonth(closes)}`;
  }
  return `${dayMonth(opens)}–${dayMonth(closes)}`;
}

export function renderMonth({
  runs,
  label,
  today,
  painter,
  width,
  venueFor,
  wide = false,
}) {
  const venueCount = new Set(runs.map(({ show }) => show.venue.id)).size;
  const footer = painter.dim(
    `${countLabel(runs.length, "show")} · ${countLabel(venueCount, "venue")} · glasgowtheatre.com`,
  );
  const priceNote = runs.some(
    ({ show }) =>
      priceLabel({ show, price: null }, { fromPrefix: false }) === "—",
  )
    ? painter.dim("— = the venue has not published a price")
    : null;

  // On a wide terminal, put half the run list beside the other half. The
  // compact row keeps the date (or "until 7 Nov") plus venue and price, and
  // drops the separate OPENS column so the two halves stay readable.
  const half = Math.floor((width - 3) / 2);
  const columnWidth = Math.min(half, 90);
  const whenWidth = 13;
  const compactVenueWidth = 16;
  const compactPriceWidth = 7;
  const compactFixed =
    whenWidth + 2 + 2 + compactVenueWidth + 2 + compactPriceWidth;
  const maxTitle = Math.max(
    16,
    ...runs.map(({ show }) => show.title.length),
  );
  const compactTitleWidth = Math.max(
    16,
    Math.min(maxTitle, 40, columnWidth - compactFixed),
  );
  if (
    !wide &&
    runs.length >= 8 &&
    columnWidth >= 64 &&
    compactFixed + compactTitleWidth <= columnWidth
  ) {
    const header = painter.dim(
      `${"WHEN".padEnd(whenWidth)}  ${"SHOW".padEnd(compactTitleWidth)}  ${"VENUE".padEnd(compactVenueWidth)}  ${"FROM".padStart(compactPriceWidth)}`,
    );
    const row = ({ show }) => {
      const venue = venuePill(
        venueFor(show),
        compactVenueWidth,
        painter,
      );
      const price = priceLabel(
        { show, price: null },
        { fromPrefix: false },
      );
      return `${compactWhen(show, today).padEnd(whenWidth)}` +
        `  ${painter.bold(truncate(show.title, compactTitleWidth).padEnd(compactTitleWidth))}` +
        `  ${venue}` +
        `  ${painter.dim(price.padStart(compactPriceWidth))}`;
    };
    const split = Math.ceil(runs.length / 2);
    const left = [header, ...runs.slice(0, split).map(row)];
    const right = [header, ...runs.slice(split).map(row)];
    const gutter = painter.dim(" │ ");
    const height = Math.max(left.length, right.length);
    const lines = [
      `${painter.bold("Glasgow Theatre")} · ${label}`,
      "",
    ];
    for (let index = 0; index < height; index += 1) {
      const leftLine = left[index] || "";
      const rightLine = right[index] || "";
      lines.push(
        `${padVisible(leftLine, columnWidth)}${gutter}${rightLine}`.trimEnd(),
      );
    }
    if (priceNote) lines.push("", priceNote);
    lines.push("", footer);
    return `${lines.join("\n")}\n`;
  }

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

  if (priceNote) lines.push("", priceNote);
  lines.push("", footer);
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
    } else {
      lines.push("Prices: not published by the venue");
    }
  } else {
    lines.push("");
    lines.push("Prices: not published by the venue");
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
