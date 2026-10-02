import { semesterLabel } from "./semester";

test("Semester 0 is the pre-semester; the rest are numbered", () => {
  expect(semesterLabel(0)).toBe("Pre-semester");
  expect(semesterLabel("0")).toBe("Pre-semester");
  expect(semesterLabel(3)).toBe("Semester 3");
  expect(semesterLabel("2")).toBe("Semester 2");
});
