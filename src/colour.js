const RESET = "\x1b[0m";

export function colourEnabled(stream = process.stdout) {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return false;
  }
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0") {
    return true;
  }
  return Boolean(stream.isTTY);
}

export function colourMode() {
  const colourterm = (process.env.COLORTERM || "").toLowerCase();
  return colourterm.includes("truecolor") || colourterm.includes("24bit")
    ? "truecolor"
    : "256";
}

const hexToRgb = (hex) => {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const CUBE = [0, 95, 135, 175, 215, 255];
const PALETTE = [];
for (const r of CUBE) for (const g of CUBE) for (const b of CUBE) PALETTE.push([r, g, b]);
for (let i = 0; i < 24; i += 1) {
  const value = 8 + i * 10;
  PALETTE.push([value, value, value]);
}

const nearest256 = new Map();
function ansi256(hex) {
  if (nearest256.has(hex)) return nearest256.get(hex);
  const [r, g, b] = hexToRgb(hex);
  let best = 16;
  let bestDistance = Number.POSITIVE_INFINITY;
  PALETTE.forEach(([pr, pg, pb], index) => {
    const distance =
      (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index + 16;
    }
  });
  nearest256.set(hex, best);
  return best;
}

function sgr(hex, mode, ground) {
  if (mode === "truecolor") {
    const [r, g, b] = hexToRgb(hex);
    return `${ground};2;${r};${g};${b}`;
  }
  return `${ground};5;${ansi256(hex)}`;
}

export function createPainter({ enabled = true, mode = colourMode() } = {}) {
  const wrap = (code, text) =>
    enabled ? `\x1b[${code}m${text}${RESET}` : text;

  return {
    enabled,
    mode,
    bold: (text) => wrap("1", text),
    dim: (text) => wrap("2", text),
    italic: (text) => wrap("3", text),
    cyan: (text) => wrap("36", text),
    green: (text) => wrap("32", text),
    red: (text) => wrap("31", text),
    fg: (hex, text) => (enabled ? `\x1b[${sgr(hex, mode, 38)}m${text}${RESET}` : text),
    pill: (text, colour, ink) => {
      if (!enabled || !colour) return text;
      return `\x1b[${sgr(colour, mode, 48)}m\x1b[${sgr(ink || "#ffffff", mode, 38)}m${text}${RESET}`;
    },
  };
}
