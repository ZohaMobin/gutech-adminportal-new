import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../Administrators/AdminModals";
import { BusyLabel } from "../../../Components/Loading/Loading";
import { InlineAlert } from "../../../Components/ErrorState/ErrorState";
import { DAYS, clashesFor, cohortOverlapsFor, cohortSentence, clashSentence, defaultTeacherId, knownRooms, minutesOf, popularPeriods, sectionLabel, teacherName, to12Bare, to12Hour } from "../../../utils/classSchedule";

const STANDARD_PERIODS = [["08:30", "09:55"], ["10:10", "11:35"], ["11:45", "13:10"], ["14:00", "15:25"]];

// Add a class, or edit one. The time can be anything (not only whole hours), the room is typed or picked from the rooms already in use, and
// the form says at once if the room, the teacher or the section is already busy, so a clash is seen before saving, not after.
const ScheduleModal = ({ schedule, defaults, sections, teachers, schedules, cohorts, onSave, onClose, classLabel }) => {
  const editing = Boolean(schedule);
  const [draft, setDraft] = useState(() => (editing
    ? { sectionId: String(schedule.sectionId?._id ?? schedule.sectionId), day: schedule.day, start: schedule.timeSlot.startTime, end: schedule.timeSlot.endTime, room: schedule.timeSlot.room || "", teacherId: String(schedule.teacherId?._id ?? schedule.teacherId ?? "") }
    : { sectionId: defaults.sectionId || "", day: defaults.day || "Monday", start: defaults.start || "", end: defaults.end || "", room: defaults.room || "", teacherId: defaults.teacherId || "" }));
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const set = (patch) => { setDraft((current) => ({ ...current, ...patch })); setServerError(""); };

  const section = sections.find((s) => String(s._id) === draft.sectionId);
  // Choosing a section in the add form brings its teacher along, until the teacher is chosen by hand.
  useEffect(() => { if (!editing && section && !draft.teacherId) setDraft((current) => ({ ...current, teacherId: defaultTeacherId(section) })); }, [editing, section]); // eslint-disable-line react-hooks/exhaustive-deps

  const periods = useMemo(() => { const used = popularPeriods(schedules, 5); return used.length >= 2 ? used : STANDARD_PERIODS; }, [schedules]);
  const rooms = useMemo(() => knownRooms(schedules), [schedules]);
  const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => teacherName(a).localeCompare(teacherName(b))), [teachers]);

  const timeOk = Boolean(draft.start && draft.end && minutesOf(draft.end) > minutesOf(draft.start));
  const asRow = { _id: schedule?._id, day: draft.day, timeSlot: { startTime: draft.start, endTime: draft.end, room: draft.room.trim() }, teacherId: draft.teacherId, sectionId: draft.sectionId, courseId: sections.find((s) => String(s._id) === String(draft.sectionId))?.courseId };
  const clashes = timeOk && draft.room.trim() ? clashesFor(asRow, schedules, schedule?._id) : [];
  const cohortWarnings = timeOk ? cohortOverlapsFor(asRow, schedules, cohorts, schedule?._id) : [];
  const complete = Boolean(draft.sectionId && draft.day && timeOk && draft.room.trim() && draft.teacherId);
  const canSave = complete && clashes.length === 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    const problem = await onSave({ ...draft, room: draft.room.trim() }, schedule);
    setSaving(false);
    if (problem) setServerError(problem);
  };

  return (
    <Modal
      title={editing ? "Edit class" : "Add class"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="cs-form" className="am-btn am-btn-primary" disabled={!canSave}>
            <BusyLabel busy={saving} busyText="Saving…" idle={editing ? "Save changes" : "Add class"} />
          </button>
        </>
      }
    >
      <form id="cs-form" className="cs-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="am-field">
          <span>Section</span>
          {editing ? (
            <input type="text" value={section ? sectionLabel(section) : ""} disabled readOnly />
          ) : (
            <select value={draft.sectionId} onChange={(event) => set({ sectionId: event.target.value, teacherId: "" })} disabled={saving}>
              <option value="">Select a section…</option>
              {[...sections].sort((a, b) => sectionLabel(a).localeCompare(sectionLabel(b))).map((s) => <option key={s._id} value={s._id}>{sectionLabel(s)}</option>)}
            </select>
          )}
        </label>

        <label className="am-field">
          <span>Day</span>
          <select value={draft.day} onChange={(event) => set({ day: event.target.value })} disabled={saving}>
            {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>

        <div className="am-field">
          <span>Time</span>
          <div className="cs-chips" role="group" aria-label="Class windows in use">
            {periods.map(([start, end]) => (
              <button type="button" key={`${start}-${end}`} className={`cs-chip ${draft.start === start && draft.end === end ? "is-on" : ""}`} onClick={() => set({ start, end })} disabled={saving}>
                {to12Bare(start)}–{to12Hour(end)}
              </button>
            ))}
          </div>
          <div className="cs-times">
            <input type="time" step="300" value={draft.start} onChange={(event) => set({ start: event.target.value })} aria-label="Start time" disabled={saving} />
            <span>to</span>
            <input type="time" step="300" value={draft.end} onChange={(event) => set({ end: event.target.value })} aria-label="End time" disabled={saving} />
          </div>
          <small className="cs-hint">{draft.start && draft.end && !timeOk ? "The end time must be after the start time." : "Any time works, not only whole hours."}</small>
        </div>

        <div className="am-field">
          <span>Room</span>
          <input type="text" list="cs-rooms" value={draft.room} onChange={(event) => set({ room: event.target.value })} placeholder="e.g. SF1, SL, ONLINE" disabled={saving} />
          <datalist id="cs-rooms">{rooms.map((room) => <option key={room} value={room} />)}</datalist>
          {rooms.length > 0 && (
            <div className="cs-chips" role="group" aria-label="Rooms in use">
              {rooms.slice(0, 8).map((room) => <button type="button" key={room} className={`cs-chip ${draft.room.trim().toLowerCase() === room.toLowerCase() ? "is-on" : ""}`} onClick={() => set({ room })} disabled={saving}>{room}</button>)}
            </div>
          )}
        </div>

        <label className="am-field">
          <span>Teacher</span>
          <select value={draft.teacherId} onChange={(event) => set({ teacherId: event.target.value })} disabled={saving}>
            <option value="">Select a teacher…</option>
            {sortedTeachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacherName(teacher)}</option>)}
          </select>
        </label>

        {complete && (
          clashes.length === 0
            ? <div className="cs-check is-ok" role="status">No clashes. The room, the teacher and the section are all free at this time.</div>
            : <div className="cs-check is-bad" role="alert">{clashes.map((clash, index) => <p key={index}>{clashSentence(clash, classLabel)}</p>)}</div>
        )}
        {complete && clashes.length === 0 && cohortWarnings.length > 0 && <div className="cs-check is-warn" role="status">{cohortWarnings.map((w, index) => <p key={index}>{cohortSentence(w, classLabel)}. You can still save.</p>)}</div>}
        {serverError && <InlineAlert message={serverError} />}
      </form>
    </Modal>
  );
};

export default ScheduleModal;
