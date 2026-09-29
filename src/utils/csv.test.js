import { csvCell, toCsv } from "./csv";

test("plain values are left alone; commas, quotes and line breaks are quoted", () => {
  expect(csvCell("Ayesha Khan")).toBe("Ayesha Khan");
  expect(csvCell("Khan, Ayesha")).toBe('"Khan, Ayesha"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell("two\nlines")).toBe('"two\nlines"');
  expect(csvCell(null)).toBe("");
  expect(csvCell(0)).toBe("0");
});

test("text that a spreadsheet would run as a formula is defused, but negative numbers are not", () => {
  expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
  expect(csvCell("+1 555")).toBe("'+1 555");
  expect(csvCell("@cmd")).toBe("'@cmd");
  expect(csvCell(-3)).toBe("-3");
  expect(csvCell("-2.5")).toBe("-2.5");
});

test("rows are joined with CRLF", () => {
  expect(toCsv([["a", "b"], [1, "c,d"]])).toBe('a,b\r\n1,"c,d"');
});
