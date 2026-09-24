import fs from "fs";
import path from "path";

// The portal has one brand colour, --primary-color (styles/global.css), and one font stack, --font-body. A second maroon
// was once hard-coded in the newer pages, and two pages asked for a font that was never loaded, so pages that were meant
// to match did not. These tests keep the tokens the single source.
const SRC = path.join(__dirname, "..");
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  return e.isDirectory() ? files(full) : [full];
});
const sources = files(SRC).filter((f) => /\.(css|js|jsx)$/.test(f) && !/\.test\./.test(f) && !f.includes(`${path.sep}Fonts${path.sep}`));
const read = (f) => fs.readFileSync(f, "utf8");
const rel = (f) => path.relative(SRC, f);

test("there is one brand maroon: the old second maroon is nowhere in the source", () => {
  const old = /#8b1538|#741230|#6d0f2a|#b5294f|rgba?\(\s*139\s*,\s*21\s*,\s*56/i;
  expect(sources.filter((f) => old.test(read(f))).map(rel)).toEqual([]);
});

test("brand-coloured rules use the tokens, so changing the brand is one edit", () => {
  const global = read(path.join(SRC, "styles", "global.css"));
  for (const token of ["--primary-color", "--primary-rgb", "--primary-dark", "--primary-tint", "--font-body"]) expect(global).toContain(token);
});

test("the body font comes from the token, and no page asks for a font that is not loaded", () => {
  expect(read(path.join(SRC, "index.css"))).toContain("font-family: var(--font-body)");
  const unloaded = sources.filter((f) => f.endsWith(".css") && /font-family:\s*["']?Inter/i.test(read(f)));
  expect(unloaded.map(rel)).toEqual([]);
});
