import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTime,
  money,
  priceLabel,
  renderAgenda,
  renderMonth,
  renderShow,
  renderVenues,
  truncate,
} from "../src/format.js";
import { createPainter } from "../src/colour.js";

const painter = createPainter({ enabled: false });

const venue = {
  id: "tron",
  name: "Tron Theatre",
  area: "Merchant City",
  colour: "#e01c70",
  ink: "#ffffff",
};

const show = (overrides = {}) => ({
  id: "thrice",
  title: "Thrice",
  artForm: "dance",
  venue: { id: "tron", name: "Tron Theatre", area: "Merchant City" },
  run: { opens: "2026-10-22", closes: "2026-10-24", time: null },
  performances: [],
  pricing: { from: 18, free: false, payWhatYouLike: false, text: "From £18" },
  ...overrides,
});

const occurrence = (overrides = {}) => ({
  date: "2026-10-22",
  time: "19:30",
  price: null,
  runOnly: false,
  show: show(),
  ...overrides,
});

test("times and money read naturally", () => {
  assert.equal(formatTime("19:30"), "7:30pm");
  assert.equal(formatTime("13:00"), "1:00pm");
  assert.equal(formatTime("00:15"), "12:15am");
  assert.equal(formatTime(null), "TBC");
  assert.equal(money(18), "£18");
  assert.equal(money(18.5), "£18.50");
});

test("prices prefer the night's exact price, then the run's from price", () => {
  assert.equal(priceLabel(occurrence({ price: 14.5 })), "£14.50");
  assert.equal(priceLabel(occurrence()), "from £18");
  assert.equal(priceLabel(occurrence(), { fromPrefix: false }), "£18");
  assert.equal(
    priceLabel(
      occurrence({
        show: show({ pricing: { from: 0, free: true, payWhatYouLike: false } }),
      }),
    ),
    "free",
  );
  assert.equal(
    priceLabel(
      occurrence({
        show: show({ pricing: { from: null, free: false, payWhatYouLike: true } }),
      }),
    ),
    "PWYL",
  );
  assert.equal(
    priceLabel(occurrence({ show: show({ pricing: null }) })),
    "—",
  );
});

test("long titles truncate at a word when they can", () => {
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("a very long show title", 12), "a very long…");
});

test("the agenda is chronological, marks run-only shows and counts performances", () => {
  const output = renderAgenda({
    dates: ["2026-10-22"],
    occurrences: [
      occurrence({ time: null, runOnly: true }),
      occurrence(),
    ],
    today: "2026-10-18",
    label: "Thursday 22 October 2026",
    painter,
    width: 100,
    venueFor: () => venue,
  });
  assert.match(output, /Glasgow Theatre · Thursday 22 October 2026/);
  assert.match(output, /THU 22 OCT · 2/);
  assert.match(output, /7:30pm/);
  assert.match(output, /TBC\*/);
  assert.match(output, /in season/);
  assert.match(output, /2 performances · 1 show · 1 venue · glasgowtheatre\.com/);
});

test("the month view is one line per show, not one line per night", () => {
  const output = renderMonth({
    runs: [
      {
        show: show({ run: { opens: "2026-10-22", closes: "2026-10-22" } }),
        firstDate: "2026-10-22",
        startsBefore: false,
      },
      {
        show: show({
          id: "panto",
          title: "Panto",
          run: { opens: "2026-10-01", closes: "2026-11-07" },
        }),
        firstDate: "2026-10-18",
        startsBefore: true,
      },
    ],
    label: "18 Oct – 16 Nov 2026",
    today: "2026-10-18",
    painter,
    width: 100,
    venueFor: () => venue,
  });
  assert.match(output, /OPENS/);
  assert.match(output, /one night/);
  assert.match(output, /until 7 Nov/);
  assert.match(output, /2 shows · 1 venue · glasgowtheatre\.com/);
});

test("the venue table lists every venue with its upcoming count", () => {
  const output = renderVenues({
    venues: [{ ...venue, upcomingShows: 11 }],
    painter,
  });
  assert.match(output, /Glasgow Theatre venues/);
  assert.match(output, /tron/);
  assert.match(output, /Tron Theatre/);
  assert.match(output, /11/);
  assert.match(output, /1 venue · glasgowtheatre\.com/);
});

test("colour can be switched on for a truecolor terminal", () => {
  const coloured = createPainter({ enabled: true, mode: "truecolor" });
  const pill = coloured.pill("Tron Theatre", "#e01c70", "#ffffff");
  assert.match(pill, /\x1b\[48;2;224;28;112m/);
  assert.match(pill, /\x1b\[38;2;255;255;255m/);
  assert.match(pill, /Tron Theatre/);
});

test("a wide week lays the days out in two balanced columns", () => {
  const dates = [
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
  ];
  const occurrences = dates.map((date) =>
    occurrence({
      date,
      show: show({
        run: { opens: date, closes: date, time: "19:30" },
      }),
    }),
  );
  const output = renderAgenda({
    dates,
    occurrences,
    today: "2026-10-18",
    label: "Sun 18 – Fri 23 October 2026",
    painter,
    width: 140,
    venueFor: () => venue,
  });
  assert.match(output, / │ /);
  assert.match(output, /SUN 18 OCT.* │ .*WED 21 OCT/);
});

test("a narrow terminal keeps the week in one column", () => {
  const dates = ["2026-10-18", "2026-10-19", "2026-10-20"];
  const occurrences = dates.map((date) =>
    occurrence({
      date,
      show: show({
        run: { opens: date, closes: date, time: "19:30" },
      }),
    }),
  );
  const output = renderAgenda({
    dates,
    occurrences,
    today: "2026-10-18",
    label: "Sun 18 – Tue 20 October 2026",
    painter,
    width: 120,
    venueFor: () => venue,
  });
  assert.doesNotMatch(output, / │ /);
  assert.match(output, /SUN 18 OCT/);
  assert.match(output, /MON 19 OCT/);
});

test("a wide month puts the run list in two columns", () => {
  const runs = Array.from({ length: 10 }, (_, index) => {
    const date = `2026-10-${String(18 + index).padStart(2, "0")}`;
    return {
      show: show({
        id: `show-${index}`,
        title: `Show number ${index + 1}`,
        run: { opens: date, closes: date },
      }),
      firstDate: date,
      startsBefore: false,
    };
  });
  const output = renderMonth({
    runs,
    label: "18 Oct – 16 Nov 2026",
    today: "2026-10-18",
    painter,
    width: 140,
    venueFor: () => venue,
  });
  assert.match(output, / │ /);
  assert.match(output, /WHEN/);
  assert.doesNotMatch(output, /OPENS/);
  assert.equal(output.match(/WHEN/g).length, 2);
});

test("a narrow or wide-flagged month stays in one column", () => {
  const runs = Array.from({ length: 10 }, (_, index) => {
    const date = `2026-10-${String(18 + index).padStart(2, "0")}`;
    return {
      show: show({
        id: `show-${index}`,
        title: `Show number ${index + 1}`,
        run: { opens: date, closes: date },
      }),
      firstDate: date,
      startsBefore: false,
    };
  });
  const narrow = renderMonth({
    runs,
    label: "18 Oct – 16 Nov 2026",
    today: "2026-10-18",
    painter,
    width: 120,
    venueFor: () => venue,
  });
  assert.doesNotMatch(narrow, / │ /);
  assert.match(narrow, /OPENS/);

  const wide = renderMonth({
    runs,
    label: "18 Oct – 16 Nov 2026",
    today: "2026-10-18",
    painter,
    width: 140,
    venueFor: () => venue,
    wide: true,
  });
  assert.doesNotMatch(wide, / │ /);
  assert.match(wide, /OPENS/);
});


test("a missing price is labelled rather than looking like free", () => {
  const output = renderAgenda({
    dates: ["2026-10-22"],
    occurrences: [
      occurrence({
        show: show({ pricing: null }),
        time: "19:30",
      }),
    ],
    today: "2026-10-18",
    label: "Thursday 22 October 2026",
    painter,
    width: 100,
    venueFor: () => venue,
  });
  assert.match(output, /— = the venue has not published a price/);
});

test("the month view also explains missing prices", () => {
  const output = renderMonth({
    runs: [
      {
        show: show({
          run: { opens: "2026-10-22", closes: "2026-10-22" },
          pricing: null,
        }),
        firstDate: "2026-10-22",
        startsBefore: false,
      },
    ],
    label: "18 Oct – 16 Nov 2026",
    today: "2026-10-18",
    painter,
    width: 100,
    venueFor: () => venue,
  });
  assert.match(output, /— = the venue has not published a price/);
});

test("a show page says when the venue published no price", () => {
  const output = renderShow({
    show: show({
      pricing: null,
      performances: [{ date: "2026-10-22", time: "19:30" }],
      description: "A show.",
    }),
    venue,
    painter,
    width: 100,
  });
  assert.match(output, /Prices: not published by the venue/);
});
