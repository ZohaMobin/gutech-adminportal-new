import { buildPeriods, periodIndexOf, to12Hour } from "./timetablePeriods";

const cls = (day, startTime, endTime, room = "SF1") => ({ day, timeSlot: { startTime, endTime, room } });
const printed = [["08:30", "09:55"], ["10:10", "11:35"], ["11:45", "13:10"], ["14:00", "15:25"]];
const week = () => ["Monday", "Tuesday", "Wednesday"].flatMap((day) => printed.map(([s, e]) => cls(day, s, e)));

test("the rows are the day's real class windows, not whole hours", () => {
  expect(buildPeriods(week()).map((p) => `${p.start}-${p.end}`)).toEqual(["08:30-09:55", "10:10-11:35", "11:45-13:10", "14:00-15:25"]);
});

test("a class that straddles two windows does not become a row of its own; it sits in the first window it overlaps", () => {
  const schedules = [...week(), cls("Monday", "09:30", "11:30"), cls("Tuesday", "08:30", "11:35"), cls("Monday", "11:00", "11:35", "ONLINE")];
  const periods = buildPeriods(schedules);
  expect(periods.map((p) => p.start)).toEqual(["08:30", "10:10", "11:45", "14:00"]);
  expect(periodIndexOf(cls("Monday", "09:30", "11:30"), periods)).toBe(0);
  expect(periodIndexOf(cls("Tuesday", "08:30", "11:35"), periods)).toBe(0);
  expect(periodIndexOf(cls("Monday", "11:00", "11:35"), periods)).toBe(1);
});

test("every class lands in some row, however odd its minutes", () => {
  const schedules = [...week(), cls("Friday", "08:45", "09:10"), cls("Friday", "15:00", "16:30"), cls("Friday", "12:00", "12:30")];
  const periods = buildPeriods(schedules);
  for (const schedule of schedules) expect(periodIndexOf(schedule, periods)).toBeGreaterThanOrEqual(0);
});

test("ordinary whole-hour timetables still give whole-hour rows", () => {
  const hourly = [cls("Monday", "09:00", "10:00"), cls("Tuesday", "09:00", "10:00"), cls("Monday", "11:00", "12:00")];
  expect(buildPeriods(hourly).map((p) => `${p.start}-${p.end}`)).toEqual(["09:00-10:00", "11:00-12:00"]);
});

test("nothing scheduled gives no rows, and a class with no usable times gets no row", () => {
  expect(buildPeriods([])).toEqual([]);
  expect(buildPeriods(undefined)).toEqual([]);
  expect(periodIndexOf(cls("Monday", "10:00", "10:00"), [{ startMinutes: 0, endMinutes: 1440 }])).toBe(-1);
});

test("twelve-hour times read as a person would say them", () => {
  expect(to12Hour("08:30")).toBe("8:30 AM");
  expect(to12Hour("13:10")).toBe("1:10 PM");
  expect(to12Hour("12:00")).toBe("12:00 PM");
  expect(to12Hour("00:15")).toBe("12:15 AM");
});
