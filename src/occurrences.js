import { eachDate } from "./dates.js";

const byTimeThenVenue = (a, b) =>
  Number(a.time == null) - Number(b.time == null) ||
  String(a.time || "").localeCompare(String(b.time || "")) ||
  a.show.venue.name.localeCompare(b.show.venue.name) ||
  a.show.title.localeCompare(b.show.title);

/**
 * One row per performance. A show with a published performance list only
 * appears on those dates; a show without one appears across its whole run and
 * is marked `runOnly` when the run spans more than one day.
 */
export function buildOccurrences(shows, from, to) {
  const dates = eachDate(from, to);
  const occurrences = [];

  for (const show of shows) {
    if (show.performances?.length) {
      for (const performance of show.performances) {
        if (performance.date < from || performance.date > to) continue;
        occurrences.push({
          date: performance.date,
          time: performance.time || null,
          price: performance.price ?? null,
          runOnly: false,
          show,
        });
      }
      continue;
    }

    const { opens, closes, time } = show.run;
    if (closes < from || opens > to) continue;

    for (const date of dates) {
      if (date < opens || date > closes) continue;
      occurrences.push({
        date,
        time: time || null,
        price: null,
        runOnly: opens !== closes,
        show,
      });
    }
  }

  return occurrences.sort(byTimeThenVenue);
}

export function groupByDate(occurrences) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    if (!groups.has(occurrence.date)) groups.set(occurrence.date, []);
    groups.get(occurrence.date).push(occurrence);
  }
  return groups;
}

/** Shows whose run intersects the window, for the month view. */
export function buildRuns(shows, from, to) {
  return shows
    .filter((show) => show.run.closes >= from && show.run.opens <= to)
    .map((show) => ({
      show,
      firstDate: show.run.opens < from ? from : show.run.opens,
      startsBefore: show.run.opens < from,
    }))
    .sort(
      (a, b) =>
        a.firstDate.localeCompare(b.firstDate) ||
        a.show.run.opens.localeCompare(b.show.run.opens) ||
        a.show.title.localeCompare(b.show.title),
    );
}

export function datesByShow(occurrences) {
  const dates = new Map();
  for (const occurrence of occurrences) {
    if (!dates.has(occurrence.show.id)) dates.set(occurrence.show.id, []);
    const list = dates.get(occurrence.show.id);
    if (list[list.length - 1] !== occurrence.date) list.push(occurrence.date);
  }
  return dates;
}
