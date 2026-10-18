import { UsageError } from "./errors.js";

const LONDON = "Europe/London";
const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const WEEKDAYS = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const isoFormatter = (options) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });

const longDate = isoFormatter({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDate = isoFormatter({
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayMonth = isoFormatter({ day: "numeric", month: "short" });
const dayMonthLong = isoFormatter({ day: "numeric", month: "long" });
const monthYear = isoFormatter({ month: "short", year: "numeric" });
const monthLongYear = isoFormatter({ month: "long", year: "numeric" });

/** Today's calendar date in Glasgow, whatever the machine's timezone is. */
export function todayInLondon(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isIsoDate(value) {
  if (!ISO_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachDate(from, to) {
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function daysBetween(from, to) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

const atNoon = (iso) => new Date(`${iso}T12:00:00Z`);

export function formatLongDate(iso) {
  return longDate.format(atNoon(iso)).replace(",", "");
}

export function formatShortDate(iso) {
  return shortDate.format(atNoon(iso));
}

export function formatDayHeader(iso) {
  return formatShortDate(iso).toUpperCase();
}

export function formatRuns(show, today) {
  const opens = show.run.opens;
  const closes = show.run.closes;
  if (opens === closes) return "one night";
  if (opens < today) return `until ${dayMonth.format(atNoon(closes))}`;
  if (opens.slice(0, 7) === closes.slice(0, 7)) {
    return `${atNoon(opens).getUTCDate()}–${dayMonth.format(atNoon(closes))}`;
  }
  if (opens.slice(0, 4) === closes.slice(0, 4)) {
    return `${dayMonth.format(atNoon(opens))}–${dayMonth.format(atNoon(closes))}`;
  }
  return `${dayMonth.format(atNoon(opens))} ${opens.slice(0, 4)}–${dayMonth.format(atNoon(closes))} ${closes.slice(0, 4)}`;
}

export function formatShowRun(show) {
  return formatDateRange(show.run.opens, show.run.closes);
}

export function formatDateRange(from, to) {
  if (from === to) return formatLongDate(from);
  const fromDate = atNoon(from);
  const toDate = atNoon(to);
  const sameMonth =
    from.slice(0, 7) === to.slice(0, 7) && from.slice(0, 4) === to.slice(0, 4);
  if (sameMonth) {
    const fromParts = shortDate.format(fromDate).split(" ");
    const toParts = shortDate.format(toDate).split(" ");
    return `${fromParts[0]} ${fromParts[1]} – ${toParts[0]} ${toParts[1]} ${monthLongYear.format(toDate)}`;
  }
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${shortDate.format(fromDate)} – ${shortDate.format(toDate)} ${to.slice(0, 4)}`;
  }
  return `${shortDate.format(fromDate)} ${from.slice(0, 4)} – ${shortDate.format(toDate)} ${to.slice(0, 4)}`;
}

export function formatMonthRange(from, to) {
  return formatDateRange(from, to);
}

function makeIso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Accepts ISO dates, "22 oct", "22/10", "today", "tomorrow" and weekday
 * names. A missing year means the next time that date comes round.
 */
export function parseDateArg(input, today = todayInLondon()) {
  const value = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!value) {
    throw new UsageError("Which date? Try 'theatre on 22 oct'.");
  }
  if (value === "today") return today;
  if (value === "tomorrow") return addDays(today, 1);
  if (isIsoDate(value)) return value;

  if (WEEKDAYS[value] != null) {
    const todayDate = new Date(`${today}T00:00:00Z`);
    const ahead = (WEEKDAYS[value] - todayDate.getUTCDay() + 7) % 7;
    return addDays(today, ahead);
  }

  const monthName = value.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/,
  );
  if (monthName) {
    const day = Number(monthName[1]);
    const month = MONTHS[monthName[2]];
    if (!month) throw invalidDate(input);
    const todayYear = Number(today.slice(0, 4));
    let year = monthName[3] ? Number(monthName[3]) : todayYear;
    if (!monthName[3]) {
      const candidate = makeIso(year, month, day);
      if (candidate && candidate < today) year += 1;
    }
    const iso = makeIso(year, month, day);
    if (!iso) throw invalidDate(input);
    return iso;
  }

  const numeric = value.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const todayYear = Number(today.slice(0, 4));
    let year = numeric[3] ? Number(numeric[3]) : todayYear;
    if (!numeric[3]) {
      const candidate = makeIso(year, month, day);
      if (candidate && candidate < today) year += 1;
    }
    const iso = makeIso(year, month, day);
    if (!iso) throw invalidDate(input);
    return iso;
  }

  throw new UsageError(
    `Couldn't read "${input}" as a date.`,
    "Try 2026-10-22, '22 oct', '22/10', today or tomorrow.",
  );
}

function invalidDate(input) {
  return new UsageError(
    `"${input}" isn't a real date.`,
    "Try 2026-10-22, '22 oct', '22/10', today or tomorrow.",
  );
}

export { monthYear, monthLongYear };
