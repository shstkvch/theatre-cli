import test from "node:test";
import assert from "node:assert/strict";
import {
  availableAreas,
  availableForms,
  filterShows,
  resolveVenues,
  splitList,
} from "../src/filters.js";
import { UsageError } from "../src/errors.js";

const venues = [
  { id: "tron", name: "Tron Theatre", area: "Merchant City" },
  { id: "citizens", name: "Citizens Theatre", area: "Gorbals" },
  { id: "oran-mor", name: "A Play, a Pie and a Pint", area: "West End" },
];

const show = (overrides = {}) => ({
  id: "show",
  title: "Show",
  artForm: "play",
  tags: ["play"],
  venue: { id: "tron", name: "Tron Theatre", area: "Merchant City" },
  description: "A new play",
  producer: null,
  pricing: { from: 12, free: false, payWhatYouLike: false },
  ...overrides,
});

test("venues accept ids, names and the obvious aliases", () => {
  assert.deepEqual([...resolveVenues(["tron"], venues)], ["tron"]);
  assert.deepEqual([...resolveVenues(["Citizens Theatre"], venues)], [
    "citizens",
  ]);
  assert.deepEqual([...resolveVenues(["citz"], venues)], ["citizens"]);
  assert.deepEqual([...resolveVenues(["oran", "tron"], venues)].sort(), [
    "oran-mor",
    "tron",
  ]);
});

test("an unknown venue is a usage error with the ids to choose from", () => {
  assert.throws(
    () => resolveVenues(["nowhere"], venues),
    (error) =>
      error instanceof UsageError &&
      error.message.includes("nowhere") &&
      error.hint.includes("tron"),
  );
});

test("comma-separated option values are split and trimmed", () => {
  assert.deepEqual(splitList(["tron, citizens", "oran"]), [
    "tron",
    "citizens",
    "oran",
  ]);
});

test("filters compose across venue, form, tag, area, price and search", () => {
  const shows = [
    show(),
    show({
      id: "free",
      title: "Free Play",
      venue: { id: "citizens", name: "Citizens Theatre", area: "Gorbals" },
      tags: ["play", "lunchtime"],
      pricing: { from: 0, free: true, payWhatYouLike: false },
    }),
    show({
      id: "music",
      artForm: "music",
      title: "A Gig",
      venue: { id: "oran-mor", name: "A Play, a Pie and a Pint", area: "West End" },
      pricing: { from: 20, free: false, payWhatYouLike: false },
    }),
  ];

  const options = {
    venue: [],
    form: ["play"],
    tag: ["lunchtime"],
    area: [],
    free: true,
    pwyl: false,
    under: null,
    q: "",
  };
  assert.deepEqual(
    filterShows(shows, options, null).map((item) => item.id),
    ["free"],
  );
  assert.deepEqual(
    filterShows(shows, { ...options, free: false, tag: [], under: 15 }, null).map(
      (item) => item.id,
    ),
    ["show", "free"],
  );
  assert.deepEqual(
    filterShows(shows, { ...options, form: [], tag: [], free: false, q: "gig" }, null).map(
      (item) => item.id,
    ),
    ["music"],
  );
  assert.deepEqual(
    filterShows(
      shows,
      { ...options, form: [], tag: [], free: false, area: ["west end"] },
      null,
    ).map((item) => item.id),
    ["music"],
  );
});

test("art form and area names are validated", () => {
  const shows = [show()];
  assert.deepEqual(availableForms(shows), ["play"]);
  assert.deepEqual(availableAreas(shows), ["Merchant City"]);
  const base = {
    venue: [],
    form: ["opera"],
    tag: [],
    area: [],
    free: false,
    pwyl: false,
    under: null,
    q: "",
  };
  assert.throws(() => filterShows(shows, base, null), UsageError);
  assert.throws(
    () => filterShows(shows, { ...base, form: [], area: ["moon"] }, null),
    UsageError,
  );
});
