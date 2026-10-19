import React from "react";
import { clashingIds, isOnline, layoutDay, roomOf, to12Bare, to12Hour } from "../../../utils/classSchedule";
import { PX_PER_MINUTE } from "./WeekBoard";

const hourLabel = (minutes) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "p" : "a"}`; };

// One day, every room side by side on the shared time axis: shows at a glance which rooms are busy and when, and where two classes meet in one room.
// Online classes get their own column, since they use no room. Clicking an empty part of a room asks to add a class there.
const RoomBoard = ({ day, axis, schedules, colors, courseKeyOf, selectedId, onSelect, onAddAt, sectionLabel, teacherLabel }) => {
  const height = (axis.end - axis.start) * PX_PER_MINUTE;
  const clashes = clashingIds(schedules);
  const names = [...new Set(schedules.map(roomOf).filter(Boolean))];
  const rooms = [...names.filter((r) => !isOnline(r)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), ...names.filter(isOnline)];
  const today = schedules.filter((s) => s.day === day);
  const columns = rooms.map((room) => ({ room, blocks: layoutDay(today.filter((s) => roomOf(s) === room), axis.start), used: today.some((s) => roomOf(s) === room) }));
  const grid = `2.4rem ${columns.length ? columns.map(({ blocks }) => { const lanes = Math.max(1, ...blocks.map((b) => b.cols)); return `minmax(${lanes * 6.5}rem, ${lanes}fr)`; }).join(" ") : "1fr"}`;
  const addAt = (event, room) => {
    if (event.target.closest(".cs-blk")) return;
    const box = event.currentTarget.getBoundingClientRect();
    onAddAt(day, Math.max(axis.start, Math.round((axis.start + (event.clientY - box.top) / PX_PER_MINUTE) / 5) * 5), isOnline(room) ? "" : room);
  };

  return (
    <section className="cs-card cs-board" aria-label={`Rooms on ${day}`}>
      <div className="cs-wkhead" style={{ gridTemplateColumns: grid }}>
        <div />
        {columns.map(({ room, used }) => <div key={room} className={used ? "" : "is-free"}>{room}{used ? "" : <small> · free</small>}</div>)}
      </div>
      <div className="cs-wkbody" style={{ gridTemplateColumns: grid }}>
        <div className="cs-hours" style={{ height }}>
          {axis.ticks.map((tick) => <span key={tick} style={{ top: (tick - axis.start) * PX_PER_MINUTE }}>{hourLabel(tick)}</span>)}
        </div>
        {columns.map(({ room, blocks }) => (
          <div key={room} className="cs-col" style={{ height }} onClick={(event) => addAt(event, room)} role="presentation" title={isOnline(room) ? undefined : `Add a class in ${room}`}>
            {axis.ticks.map((tick) => <i key={tick} className="cs-line" style={{ top: (tick - axis.start) * PX_PER_MINUTE }} />)}
            {blocks.map(({ schedule, top, length, lane, cols }) => {
              const clash = clashes.has(String(schedule._id)) && !isOnline(room);
              return (
                <button
                  type="button" key={schedule._id}
                  className={`cs-blk ${selectedId === String(schedule._id) ? "is-selected" : ""} ${clash ? "is-clash" : ""} ${length < 50 ? "is-short" : ""}`}
                  style={{ ...(colors[courseKeyOf(schedule)] || {}), top: top * PX_PER_MINUTE, height: length * PX_PER_MINUTE - 2, left: `${(lane / cols) * 100}%`, width: `calc(${100 / cols}% - 3px)` }}
                  onClick={() => onSelect(String(schedule._id))}
                  aria-label={`${schedule.courseId?.name || "Class"}, ${room}, ${to12Hour(schedule.timeSlot.startTime)} to ${to12Hour(schedule.timeSlot.endTime)}${clash ? ", clashes with another class" : ""}`}
                >
                  <b>{schedule.courseId?.name || "Class"}</b>
                  <span>{to12Bare(schedule.timeSlot.startTime)}–{to12Bare(schedule.timeSlot.endTime)}</span>
                  <span className="cs-blk-3">{teacherLabel(schedule)} · {sectionLabel(schedule)}</span>
                  {clash && <i className="cs-tag">Clash</i>}
                </button>
              );
            })}
          </div>
        ))}
        {rooms.length === 0 && <div className="cs-empty-day">No classes yet.</div>}
      </div>
    </section>
  );
};

export default RoomBoard;
