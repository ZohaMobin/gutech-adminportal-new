// A cell of a CSV file. Quotes it when it holds a comma, quote or line break. A cell that starts with = + - @ would be run as a
// formula by Excel or Sheets, so it gets a leading apostrophe (names and titles are typed by people, not trusted).
export const csvCell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

// Saves the rows as a .csv file. The byte-order mark makes Excel read names in other scripts correctly.
export const downloadCsv = (filename, rows) => {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
