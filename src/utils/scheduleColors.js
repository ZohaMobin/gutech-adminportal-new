// Card colours for the timetable. Each course (or section) gets the next hue in this list, in order, so
// the ones on screen never repeat until the list runs out. The hues alternate between warm and cool so
// neighbours in the order look clearly different, and they share one saturation and lightness, so the whole
// board reads as a single soft palette instead of a pile of unrelated pastels.
const HUES = [232, 38, 152, 346, 196, 268, 18, 172, 304, 80, 214, 52];
const CARD_SATURATION = 78;
const CARD_LIGHTNESS = 93;
export const CARD_COLORS = HUES.map((hue) => `hsl(${hue}, ${CARD_SATURATION}%, ${CARD_LIGHTNESS}%)`);

// A lab's code is its theory course's code plus "L" (CS-301 and CS-301L).
const labOf = (code) => {
  const match = /^(.*\d)L$/i.exec(String(code || '').trim());
  return match ? match[1] : null;
};

const HSL = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/;

// The same hue a little deeper, so a lab reads as belonging to its theory course but is still its own card.
export const deepen = (color) => {
  const m = HSL.exec(color);
  if (!m) return color;
  return `hsl(${m[1]}, ${Math.round(m[2] * 0.9)}%, ${Math.max(0, m[3] - 8)}%)`;
};

// The inline style for a card: its tint, plus the stronger accent (left edge) and ink (course code) taken
// from the same hue. A colour that is not one of ours (the grey default) just becomes the background.
export const cardStyle = (color) => {
  const m = HSL.exec(color);
  if (!m) return { backgroundColor: color };
  return {
    backgroundColor: color,
    '--card-accent': `hsl(${m[1]}, 62%, 46%)`,
    '--card-ink': `hsl(${m[1]}, 55%, 22%)`,
  };
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
