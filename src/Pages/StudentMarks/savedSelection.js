// Which section the Marks page is showing, kept in the address (so Back, refresh and a pasted link land on the same
// gradebook) and remembered in this browser (so opening the page later starts where the admin left off).
const STORAGE_KEY = "adminMarksSelection";
const FIELDS = { academicYearId: "term", department: "department", program: "program", semester: "semester", course: "course", section: "section" };

export const EMPTY_SELECTION = { department: "", program: "", academicYearId: "", semester: "", course: "", section: "" };

// The address wins; the remembered selection is used only when the address names nothing.
export const readSelection = (search, storage) => {
  const params = new URLSearchParams(search);
  const fromAddress = { ...EMPTY_SELECTION };
  let named = false;
  Object.entries(FIELDS).forEach(([key, param]) => {
    const value = params.get(param);
    if (value) { fromAddress[key] = value; named = true; }
  });
  if (named) return fromAddress;
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      return Object.fromEntries(Object.keys(EMPTY_SELECTION).map((key) => [key, typeof saved[key] === "string" ? saved[key] : ""]));
    }
  } catch (err) { /* private window or a damaged value: start empty */ }
  return { ...EMPTY_SELECTION };
};

export const selectionToSearch = (selection) => {
  const params = new URLSearchParams();
  Object.entries(FIELDS).forEach(([key, param]) => { if (selection[key] !== "" && selection[key] != null) params.set(param, String(selection[key])); });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const saveSelection = (selection, { history, location, storage }) => {
  try { history.replaceState(history.state, "", `${location.pathname}${selectionToSearch(selection)}`); } catch (err) { /* not in a browser */ }
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch (err) { /* storage unavailable */ }
};
