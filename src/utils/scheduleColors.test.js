import { CARD_COLORS, assignCardColors, deepen, cardStyle } from './scheduleColors';

describe('assignCardColors', () => {
  it('gives every course on a timetable its own colour', () => {
    const map = assignCardColors(['CS-302', 'CS-303L', 'CS-304', 'CS-301L', 'CS-301', 'CS-306L', 'CS-303']);
    expect(new Set(Object.values(map)).size).toBe(7);
  });
  it('does not depend on the order the rows arrive in', () => {
    const a = assignCardColors(['B', 'A', 'C']);
    const b = assignCardColors(['C', 'B', 'A', 'A']);
    expect(a).toEqual(b);
  });
  it('colours a repeated key once and tolerates empty input', () => {
    expect(Object.keys(assignCardColors(['X', 'X', null, undefined, '']))).toEqual(['X']);
    expect(assignCardColors([{ code: 'CS-1' }])).toEqual({});
    expect(assignCardColors(undefined)).toEqual({});
  });
  it('gives a lab the deeper shade of its theory course colour', () => {
    const map = assignCardColors(['CS-301', 'CS-301L', 'CS-302']);
    expect(map['CS-301']).toBe(CARD_COLORS[0]);
    expect(map['CS-301L']).toBe(deepen(CARD_COLORS[0]));
    expect(map['CS-301L']).not.toBe(map['CS-301']);
    expect(map['CS-302']).toBe(CARD_COLORS[1]);
  });
  it('treats a lab on its own like any other course', () => {
    const map = assignCardColors(['CS-303L', 'CS-304']);
    expect(map['CS-303L']).toBe(deepen(CARD_COLORS[0]));
    expect(map['CS-304']).toBe(CARD_COLORS[1]);
  });
  it('groups by course code when the key is a section id', () => {
    const map = assignCardColors([{ key: 'sec1', code: 'CS-301' }, { key: 'sec2', code: 'CS-301L' }, { key: 'sec3', code: 'CS-301' }, { key: 'sec4' }]);
    expect(map.sec1).toBe(map.sec3);
    expect(map.sec2).toBe(deepen(map.sec1));
    expect(map.sec4).toBeDefined();
  });
  it('only wraps round after the palette is used up', () => {
    const keys = Array.from({ length: CARD_COLORS.length + 1 }, (_, i) => `K${String(i).padStart(2, '0')}`);
    const map = assignCardColors(keys);
    expect(new Set(Object.values(map).slice(0, CARD_COLORS.length)).size).toBe(CARD_COLORS.length);
    expect(map[keys[CARD_COLORS.length]]).toBe(CARD_COLORS[0]);
  });
  it('has no repeated colours in the palette', () => {
    expect(new Set(CARD_COLORS).size).toBe(CARD_COLORS.length);
  });
  it('builds a card style from a palette colour and falls back for anything else', () => {
    const style = cardStyle(CARD_COLORS[0]);
    expect(style.backgroundColor).toBe(CARD_COLORS[0]);
    expect(style['--card-accent']).toMatch(/^hsl\(232, /);
    expect(style['--card-ink']).toMatch(/^hsl\(232, /);
    expect(cardStyle('#f8f9fa')).toEqual({ backgroundColor: '#f8f9fa' });
    expect(deepen('#f8f9fa')).toBe('#f8f9fa');
  });
});
