# theatre-cli

What's on in Glasgow's theatres, from your terminal.

`theatre` is a small, zero-dependency CLI that reads the live
[Glasgow Theatre](https://glasgowtheatre.com) API and shows what is on today,
this week or this month. Each venue keeps the same house colour it uses on the
site's calendar.

```
$ theatre week

Glasgow Theatre · Sun 18 – Sat 24 October 2026

SUN 18 OCT · TODAY · 4
  12:30pm  An Audience with Christian Horner             Pavilion Theatre             —
   7:30pm  The Big Comedy Roadshow                       Tron Theatre        from £23.50
      TBC  Turn a different corner                       Cottiers                     —
      TBC  Kyle MacLachlan – Fictional Selves            King's Theatre               —

MON 19 OCT · 3
   1:00pm  Lune                                          A Play, a Pie and a Pint   £17
   7:00pm  The Seven Witches of Torryburn                Cottiers             from £17
   7:30pm  Alice Cooper - Devil On My Shoulder Book Tour Pavilion Theatre             —

...
35 performances · 19 shows · 8 venues · glasgowtheatre.com
```

## Install

Requires Node 20 or newer.

```sh
npm install -g theatre-cli
```

Or from source:

```sh
git clone https://github.com/shstkvch/theatre-cli.git
cd theatre-cli
npm install -g .
```

## Use

```sh
theatre                     # today
theatre week                # the next seven days
theatre month               # the next thirty days
theatre on "22 oct"         # a specific day
theatre show lune           # one show, every performance
theatre venues              # venue ids, areas and colours
```

Dates can be written as `2026-10-22`, `22 oct`, `22/10`, `today`, `tomorrow`
or a weekday (`fri`). A missing year means the next time that date comes
round.

### Filters

```sh
theatre week --venue tron,citizens
theatre month --venue oran-mor --form play
theatre today --area "West End"
theatre week --free
theatre month --under 15
theatre week --tag lunchtime
theatre month --q macbeth
```

| Option | Meaning |
| --- | --- |
| `--venue <id\|name>` | One venue; repeat or comma-separate |
| `--area <area>` | `City Centre`, `West End`, `Southside`, … |
| `--form <form>` | `play`, `musical`, `dance`, `stand-up`, `opera`, … |
| `--tag <tag>` | Any tag, including `lunchtime` |
| `--free` | Only free shows |
| `--pwyl` | Only pay-what-you-like shows |
| `--under <price>` | Only shows whose from-price is at most this |
| `--q <text>` | Search titles, venues and descriptions |
| `--json` | Machine-readable output |
| `--plain` | No colour |
| `--wide` | Do not truncate long titles |
| `--refresh` | Ignore the ten-minute cache |

### What the rows mean

- **One row per performance.** A matinee and an evening show are two rows.
- **`TBC`** means the show is on that day, but the venue has not published a
  time.
- **`*`** means the run covers that day but the venue publishes no nightly
  schedule. Without it, a three-week opera run would look confirmed every
  night.
- **Prices** are for that exact performance when the API has one. Otherwise
  the row says `from £x`, `free`, `PWYL`, or `—` when no price was published.
- **`month`** is one line per show, not one line per night, so a long run does
  not swamp the list.

## Colour

Venue names are drawn as coloured pills, using the same house palette as the
[glasgowtheatre.com calendar](https://glasgowtheatre.com/calendar.html). The
API publishes both `colour` and `ink` for every venue (API v1.1), so the CLI
does not invent its own palette. Dark venues such as the Citz and Cottiers get
white text; lighter ones such as the Glad and Theatre 118 get near-black text.

Colour is enabled only on a TTY. `NO_COLOR=1`, `--plain`, or a pipe disables
it. Truecolor is used when `COLORTERM` advertises it; otherwise the nearest
xterm-256 colour is used.

## JSON

`--json` is useful for scripts. For day and week views it returns the API's
show objects unchanged, plus a `dates` array for each show:

```json
{
  "command": "week",
  "from": "2026-10-18",
  "to": "2026-10-24",
  "source": {
    "apiVersion": "1.1",
    "generatedAt": "2026-10-18T09:11:20.684Z",
    "refreshedAt": "2026-10-18T09:10:58.670Z"
  },
  "count": 19,
  "shows": [
    {
      "id": "oran-mor-lune",
      "title": "Lune",
      "...": "the rest of the API show object",
      "dates": ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]
    }
  ]
}
```

```sh
theatre week --json | jq -r '.shows[] | "\(.run.opens)  \(.title)"'
```

## Data and caching

Everything comes from the free, read-only API at
`https://glasgowtheatre.com/api/v1/`. No key, no account. The CLI fetches
`shows.json` and `venues.json` and keeps them in
`$XDG_CACHE_HOME/theatre-cli/` (usually `~/.cache/theatre-cli/`) for ten
minutes. If the network is down, it falls back to the last good copy and says
so on stderr. `--refresh` bypasses the cache.

The API rebuilds daily, so a ten-minute cache is plenty. Set
`THEATRE_API_ROOT` to point at a local or staging API.

Listings are free to use with attribution to
[Glasgow Theatre](https://glasgowtheatre.com). Times and prices are a guide;
always confirm with the venue. This project is not affiliated with any venue.

## Development

```sh
npm test
node bin/theatre.js week --plain
```

The code is deliberately dependency-free:

- `src/api.js` — fetch, validate and cache the two snapshots
- `src/dates.js` — Europe/London dates and the human date parser
- `src/occurrences.js` — performance-aware "what's on" rows
- `src/filters.js` — venue/form/area/price/search filters
- `src/format.js` — agenda, month, show and venue layouts
- `src/colour.js` — ANSI truecolor/256-colour painter
- `src/fallback-colours.js` — offline copy of the venue palette

## Licence

MIT. See [LICENSE](LICENSE).
