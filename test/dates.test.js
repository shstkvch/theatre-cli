import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  eachDate,
  formatDateRange,
  formatLongDate,
  formatRuns,
  parseDateArg,
  todayInLondon,
} from "../src/dates.js";
import { UsageError } from "../src/errors.js";

test("today is a Glasgow date, even late in a UTC evening", () => {
  assert.equal(todayInLondon(new Date("2026-10-18T10:00:00Z")), "2026-10-18");
  assert.equal(todayInLondon(new Date("2026-10-18T23:30:00Z")), "2026-10-19");
});

test("civil date arithmetic does not drift over DST", () => {
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", -1), "2026-10-24");
  assert.deepEqual(eachDate("2026-10-18", "2026-10-20"), [
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
  ]);
});

test("labels read like the site's prose", () => {
  assert.equal(formatLongDate("2026-10-18"), "Sunday 18 October 2026");
  assert.equal(
    formatDateRange("2026-10-18", "2026-10-24"),
    "Sun 18 – Sat 24 October 2026",
  );
  assert.equal(
    formatDateRange("2026-10-18", "2026-11-08"),
    "Sun 18 Oct – Sun 8 Nov 2026",
  );
});

test("run labels avoid repeating the month", () => {
  const show = {
    run: { opens: "2026-10-19", closes: "2026-10-24" },
  };
  assert.equal(formatRuns(show, "2026-10-18"), "19–24 Oct");
  assert.equal(
    formatRuns(
      { run: { opens: "2026-10-22", closes: "2026-11-07" } },
      "2026-10-18",
    ),
    "22 Oct–7 Nov",
  );
  assert.equal(
    formatRuns(
      { run: { opens: "2026-10-01", closes: "2026-10-24" } },
      "2026-10-18",
    ),
    "until 24 Oct",
  );
});

test("dates can be written the way people write them", () => {
  assert.equal(parseDateArg("2026-10-22", "2026-10-18"), "2026-10-22");
  assert.equal(parseDateArg("22 oct", "2026-10-18"), "2026-10-22");
  assert.equal(parseDateArg("22 October", "2026-10-18"), "2026-10-22");
  assert.equal(parseDateArg("22/10", "2026-10-18"), "2026-10-22");
  assert.equal(parseDateArg("today", "2026-10-18"), "2026-10-18");
  assert.equal(parseDateArg("tomorrow", "2026-10-18"), "2026-10-19");
  assert.equal(parseDateArg("fri", "2026-10-18"), "2026-10-23");
  assert.equal(parseDateArg("5 jan", "2026-12-20"), "2027-01-05");
  assert.equal(parseDateArg("5 jan 2028", "2026-12-20"), "2028-01-05");
});

test("impossible dates are rejected with a helpful error", () => {
  assert.throws(() => parseDateArg("2026-02-31"), UsageError);
  assert.throws(() => parseDateArg("nonsense"), UsageError);
});
