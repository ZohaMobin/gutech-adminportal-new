import { EMPTY_SELECTION, readSelection, saveSelection, selectionToSearch } from "./savedSelection";

const memoryStorage = (initial) => {
  const data = { ...(initial ? { adminMarksSelection: JSON.stringify(initial) } : {}) };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, data };
};
const full = { academicYearId: "t1", department: "d1", program: "p1", semester: "0", course: "c1", section: "s1" };

test("the address round-trips, and semester 0 is kept", () => {
  expect(readSelection(selectionToSearch(full), memoryStorage())).toEqual(full);
  expect(selectionToSearch(EMPTY_SELECTION)).toBe("");
});

test("the address wins over the remembered selection, which is used only when the address names nothing", () => {
  const storage = memoryStorage({ ...full, section: "old" });
  expect(readSelection("?term=t9", storage)).toEqual({ ...EMPTY_SELECTION, academicYearId: "t9" });
  expect(readSelection("", storage).section).toBe("old");
});

test("a damaged or unavailable store means an empty start, never an error", () => {
  expect(readSelection("", { getItem: () => "{not json" })).toEqual(EMPTY_SELECTION);
  expect(readSelection("", { getItem: () => { throw new Error("blocked"); } })).toEqual(EMPTY_SELECTION);
  expect(readSelection("", null)).toEqual(EMPTY_SELECTION);
});

test("saving rewrites the address in place (no new history entry) and remembers the choice", () => {
  const storage = memoryStorage();
  const history = { state: { idx: 3 }, replaceState: jest.fn() };
  saveSelection(full, { history, location: { pathname: "/marks" }, storage });
  expect(history.replaceState).toHaveBeenCalledWith({ idx: 3 }, "", "/marks?term=t1&department=d1&program=p1&semester=0&course=c1&section=s1");
  expect(JSON.parse(storage.data.adminMarksSelection)).toEqual(full);
});
