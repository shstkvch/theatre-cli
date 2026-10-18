import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOccurrences,
  buildRuns,
  datesByShow,
} from "../src/occurrences.js";

const show = (overrides = {}) => ({
  id: "thrice",
  title: "Thrice",
  artForm: "dance",
  tags: [],
  venue: { id: "tramway", name: "Tramway", area: "Pollokshields" },
  run: { opens: "2026-10-16", closes: "2026-10-17", time: null },
  performances: [],
  pricing: null,
  ...overrides,
});

test("published performances define the days a show is on", () => {
  const occurrences = buildOccurrences(
    [
      show({
        run: { opens: "2026-10-22", closes: "2026-10-25", time: "19:30" },
        performances: [
          { date: "2026-10-22", time: "14:00", price: 14.5 },
          { date: "2026-10-22", time: "19:30", price: 18 },
          { date: "2026-10-24", time: "19:30" },
        ],
      }),
    ],
    "2026-10-18",
    "2026-10-24",
  );
  assert.deepEqual(
    occurrences.map((occurrence) => [occurrence.date, occurrence.time]),
    [
      ["2026-10-22", "14:00"],
      ["2026-10-22", "19:30"],
      ["2026-10-24", "19:30"],
    ],
  );
  assert.equal(occurrences[0].price, 14.5);
  assert.equal(occurrences[0].runOnly, false);
});

test("a run with no performance list appears every day and is marked run-only", () => {
  const occurrences = buildOccurrences(
    [show({ run: { opens: "2026-10-22", closes: "2026-10-24", time: "19:30" } })],
    "2026-10-21",
    "2026-10-25",
  );
  assert.equal(occurrences.length, 3);
  assert.ok(occurrences.every((occurrence) => occurrence.runOnly));
  assert.ok(occurrences.every((occurrence) => occurrence.time === "19:30"));
});

test("a one-night run without performances is not marked run-only", () => {
  const [occurrence] = buildOccurrences(
    [show({ run: { opens: "2026-10-18", closes: "2026-10-18", time: null } })],
    "2026-10-18",
    "2026-10-18",
  );
  assert.equal(occurrence.runOnly, false);
  assert.equal(occurrence.time, null);
});

test("unknown times sort after known ones", () => {
  const occurrences = buildOccurrences(
    [
      show({
        id: "a",
        title: "A",
        run: { opens: "2026-10-18", closes: "2026-10-18", time: null },
      }),
      show({
        id: "b",
        title: "B",
        run: { opens: "2026-10-18", closes: "2026-10-18", time: "19:30" },
      }),
    ],
    "2026-10-18",
    "2026-10-18",
  );
  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.show.title),
    ["B", "A"],
  );
});

test("month runs carry the first relevant date", () => {
  const runs = buildRuns(
    [
      show({ id: "late", run: { opens: "2026-10-29", closes: "2026-11-02" } }),
      show({ id: "early", run: { opens: "2026-10-10", closes: "2026-10-20" } }),
    ],
    "2026-10-18",
    "2026-11-16",
  );
  assert.deepEqual(
    runs.map((run) => [run.show.id, run.firstDate, run.startsBefore]),
    [
      ["early", "2026-10-18", true],
      ["late", "2026-10-29", false],
    ],
  );
});

test("show dates are unique and ordered", () => {
  const occurrences = buildOccurrences(
    [
      show({
        performances: [
          { date: "2026-10-18", time: "14:00" },
          { date: "2026-10-18", time: "19:30" },
          { date: "2026-10-19", time: "19:30" },
        ],
      }),
    ],
    "2026-10-18",
    "2026-10-19",
  );
  assert.deepEqual(datesByShow(occurrences).get("thrice"), [
    "2026-10-18",
    "2026-10-19",
  ]);
});
