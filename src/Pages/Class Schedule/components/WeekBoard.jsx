import React from "react";
import { clashingIds, layoutDay, roomOf, to12Bare, to12Hour } from "../../../utils/classSchedule";

const PX_PER_MINUTE = 56 / 60;           // one hour is 56px tall
const SHORT_CLASS = 50;                   // minutes: a block shorter than this shows only its name and time
const hourLabel = (minutes) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "p" : "a"}`; };

// The week on a real time axis: each class where it really starts and ends, overlapping ones side by side. Clicking a class selects it;
// clicking an empty part of a day asks to add a class there.
const WeekBoard = ({ days, axis, schedules, colors, courseKeyOf, mode, selectedId, onSelect, onAddAt, sectionLabel, teacherLabel, allSchedules }) => {
  const height = (axis.end - axis.start) * PX_PER_MINUTE;
  const clashes = clashingIds(allSchedules || schedules);
  const columns = days.map((day) => ({ day, blocks: layoutDay(schedules.filter((s) => s.day === day), axis.start) }));
  // A day with many overlapping classes gets a wider column (6.5rem per lane), so blocks stay readable; the board scrolls sideways if needed.
  const grid = `2.4rem ${columns.map(({ blocks }) => { const lanes = Math.max(1, ...blocks.map((b) => b.cols)); return `minmax(${Math.max(lanes * 6.5, 5.5)}rem, ${lanes}fr)`; }).join(" ")}`;
  const addAt = (event, day) => {
    if (event.target.closest(".cs-blk")) return;
    const box = event.currentTarget.getBoundingClientRect();
    const raw = axis.start + (event.clientY - box.top) / PX_PER_MINUTE;
    onAddAt(day, Math.max(axis.start, Math.round(raw / 5) * 5));
  };

  return (
    <section className="cs-card cs-board" aria-label="Week">
      <div className="cs-wkhead" style={{ gridTemplateColumns: grid }}>
        <div />
        {days.map((day) => <div key={day}>{day.slice(0, 3)}</div>)}
      </div>
      <div className="cs-wkbody" style={{ gridTemplateColumns: grid }}>
        <div className="cs-hours" style={{ height }}>
          {axis.ticks.map((tick) => <span key={tick} style={{ top: (tick - axis.start) * PX_PER_MINUTE }}>{hourLabel(tick)}</span>)}
        </div>
        {columns.map(({ day, blocks }) => (
          <div key={day} className="cs-col" style={{ height }} onClick={(event) => addAt(event, day)} role="presentation" title={`Add a class on ${day}`}>
            {axis.ticks.map((tick) => <i key={tick} className="cs-line" style={{ top: (tick - axis.start) * PX_PER_MINUTE }} />)}
            {blocks.map(({ schedule, top, length, lane, cols }) => {
              const clash = clashes.has(String(schedule._id));
              const key = courseKeyOf(schedule);
              const second = mode === "room" ? to12Bare(schedule.timeSlot.startTime) + "–" + to12Bare(schedule.timeSlot.endTime) : `${to12Bare(schedule.timeSlot.startTime)}–${to12Bare(schedule.timeSlot.endTime)} · ${roomOf(schedule)}`;
              const third = mode === "teacher" || mode === "all" ? (mode === "all" ? `${teacherLabel(schedule)} · ${sectionLabel(schedule)}` : sectionLabel(schedule)) : mode === "room" ? `${teacherLabel(schedule)} · ${sectionLabel(schedule)}` : teacherLabel(schedule);
              return (
                <button
                  type="button"
                  key={schedule._id}
                  className={`cs-blk ${selectedId === String(schedule._id) ? "is-selected" : ""} ${clash ? "is-clash" : ""} ${length < SHORT_CLASS ? "is-short" : ""}`}
                  style={{ ...(colors[key] || {}), top: top * PX_PER_MINUTE, height: length * PX_PER_MINUTE - 2, left: `${(lane / cols) * 100}%`, width: `calc(${100 / cols}% - 3px)` }}
                  onClick={() => onSelect(String(schedule._id))}
                  aria-label={`${schedule.courseId?.name || "Class"}, ${schedule.day}, ${to12Hour(schedule.timeSlot.startTime)} to ${to12Hour(schedule.timeSlot.endTime)}${clash ? ", clashes with another class" : ""}`}
                >
                  <b>{schedule.courseId?.name || "Class"}</b>
                  <span>{second}</span>
                  <span className="cs-blk-3">{third}</span>
                  {clash && <i className="cs-tag">Clash</i>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

export { PX_PER_MINUTE };
export default WeekBoard;
