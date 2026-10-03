// The rows of a timetable, worked out from the classes themselves instead of a fixed list of whole hours.
//
// A university day is usually not hourly (08:30-09:55, 10:10-11:35, ...), and some classes straddle two of those windows
// (a 09:30-11:30 theory class). So: the rows are the most common class windows that do not overlap one another, and each
// class sits in the first row it overlaps, showing its own times. Nothing is ever dropped for starting at a "wrong" minute.

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + (minutes || 0);
};
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const overlaps = (a, b) => a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;

export const windowOf = (schedule) => ({ startMinutes: toMinutes(schedule?.timeSlot?.startTime), endMinutes: toMinutes(schedule?.timeSlot?.endTime) });

// [{ start: "08:30", end: "09:55", startMinutes, endMinutes }], earliest first.
export const buildPeriods = (schedules) => {
  const counted = new Map();
  for (const schedule of schedules || []) {
    const window = windowOf(schedule);
    if (!(window.endMinutes > window.startMinutes)) continue;
    const key = `${window.startMinutes}-${window.endMinutes}`;
    counted.set(key, { ...window, count: (counted.get(key)?.count || 0) + 1 });
  }
  const ranked = [...counted.values()].sort((a, b) => b.count - a.count || a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const chosen = [];
  for (const window of ranked) if (!chosen.some((period) => overlaps(period, window))) chosen.push(window);
  return chosen
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(({ startMinutes, endMinutes }) => ({ start: toTime(startMinutes), end: toTime(endMinutes), startMinutes, endMinutes }));
};

// The index of the row a class belongs in (the first one it overlaps), or -1 when it has no usable times.
export const periodIndexOf = (schedule, periods) => {
  const window = windowOf(schedule);
  if (!(window.endMinutes > window.startMinutes)) return -1;
  return periods.findIndex((period) => overlaps(period, window));
};

// "08:30" -> "8:30 AM"
export const to12Hour = (time) => {
  const [hours, minutes] = String(time).split(":");
  const hour = parseInt(hours, 10);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
};
