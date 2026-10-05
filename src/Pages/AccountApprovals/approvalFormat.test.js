import { initialsOf, waitingFor, formatDay } from "./approvalFormat";

const now = new Date("2026-10-05T12:00:00Z").getTime();

test("initials come from the first two words, and never come out empty", () => {
  expect(initialsOf("Sara Ahmed Khan")).toBe("SA");
  expect(initialsOf("omar")).toBe("O");
  expect(initialsOf("")).toBe("?");
});

test("waiting time reads as a person would say it", () => {
  expect(waitingFor("2026-10-05T08:00:00Z", now)).toBe("today");
  expect(waitingFor("2026-10-04T08:00:00Z", now)).toBe("yesterday");
  expect(waitingFor("2026-10-01T08:00:00Z", now)).toBe("4 days ago");
  expect(waitingFor("2026-08-01T08:00:00Z", now)).toBe("2 months ago");
  expect(waitingFor(undefined, now)).toBe("");
});

test("a missing date shows a dash", () => {
  expect(formatDay(undefined)).toBe("—");
});
