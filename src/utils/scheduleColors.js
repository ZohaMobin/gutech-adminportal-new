// Card colours for the timetable. Each course (or section) gets the next colour in this list, in order,
// so the ones on screen never repeat until the list runs out. (Hashing the id picked colours at random,
// and two courses on the same timetable often ended up the same.) The list alternates warm and cool
// hues so neighbours in the order look clearly different, and every colour is light enough for dark text.
export const CARD_COLORS = [
  '#ffc9c9', // red
  '#a5d8ff', // blue
  '#ffec99', // yellow
  '#d0bfff', // violet
  '#b2f2bb', // green
  '#ffd8a8', // orange
  '#99e9f2', // cyan
  '#fcc2d7', // pink
  '#bac8ff', // indigo
  '#d8f5a2', // lime
  '#eebefa', // magenta
  '#e6d3b3', // tan
  '#96f2d7', // teal
  '#ced4da', // grey
  '#ffe3e3', // rose
  '#c5e1a5', // olive
];

// A lab's code is its theory course's code plus "L" (CS-301 and CS-301L).
const labOf = (code) => {
  const match = /^(.*\d)L$/i.exec(String(code || '').trim());
  return match ? match[1] : null;
};

// The same hue a little deeper, so a lab reads as belonging to its theory course but is still its own card.
export const deepen = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return `hsl(${Math.round(h)}, ${Math.round(s * 0.85 * 100)}%, ${Math.round(Math.max(0, l - 0.1) * 100)}%)`;
};

// items -> { key: colour }. An item is a key, or { key, code } when the key is not the course code (a
// section id, say). Colours go to courses in sorted order, so the result does not depend on the order the
// rows arrived in; a lab shares its theory course's colour family, in the deeper shade.
export const assignCardColors = (items) => {
  const entries = new Map();
  (items || []).forEach((item) => {
    const key = item && typeof item === 'object' ? item.key : item;
    if (!key) return;
    const code = item && typeof item === 'object' ? item.code : item;
    entries.set(String(key), String(code || key));
  });
  const groupOf = (code) => labOf(code) || code;
  const groups = [...new Set([...entries.values()].map(groupOf))].sort();
  const map = {};
  entries.forEach((code, key) => {
    const base = CARD_COLORS[groups.indexOf(groupOf(code)) % CARD_COLORS.length];
    map[key] = labOf(code) ? deepen(base) : base;
  });
  return map;
};
