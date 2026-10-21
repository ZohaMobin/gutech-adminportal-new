import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Loading from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import ErrorState from "../../Components/ErrorState/ErrorState";
import { ConfirmModal } from "../Administrators/AdminModals";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { formatSectionTeachers } from "../../utils/sectionTeachers";
import { messageOf, NETWORK_MESSAGE } from "../../utils/apiMessage";
import {
  DAYS, MODES, sectionLabel, axisOf, cohortFilterOptions, hasCohortFilter, matchesCohortFilter, clashesFor, clashingIds, cohortOverlapIds, cohortOverlapsFor, cohortSentence, cohortsBySection, clashSentence, courseColors, courseKey, entityOptions, matchesEntity, sectionsWithoutClasses, teachersBySection,
  teacherName, timeOf, to12Bare, to12Hour, visibleDays,
} from "../../utils/classSchedule";
import WeekBoard from "./components/WeekBoard";
import RoomBoard from "./components/RoomBoard";
import FilterPick from "./components/FilterPick";
import ScheduleModal from "./components/ScheduleModal";
import "./Class Schedule.css";

const apiUrl = process.env.REACT_APP_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` });
const idOf = (value) => String(value?._id ?? value ?? "");
const DEFAULT_LENGTH = 85;                                  // minutes: one standard period
const classes = (n) => `${n} ${n === 1 ? "class" : "classes"}`;

// Every section's schedule rows, each tied to its section, course and teacher so the page can show names without asking again.
const loadSchedules = async (sections, teachers) => {
  const responses = await Promise.all(sections.map((section) => axios.get(`${apiUrl}/api/section-schedules/section/${section._id}`, { headers: authHeaders() }).then((r) => r.data, (error) => ({ error }))));
  const failures = responses.filter((r) => r && r.error);
  if (sections.length && failures.length === sections.length) throw failures[0].error;      // nothing loaded at all: that is an error, not an empty timetable
  const sectionById = new Map(sections.map((s) => [idOf(s), s]));
  const teacherById = new Map(teachers.map((t) => [idOf(t), t]));
  return responses.flatMap((rows) => (Array.isArray(rows) ? rows : [])).map((row) => {
    const sectionId = idOf(row.sectionId);
    const section = sectionById.get(sectionId);
    const teacher = typeof row.teacherId === "object" && row.teacherId?.userId ? row.teacherId : teacherById.get(idOf(row.teacherId)) || { _id: idOf(row.teacherId) };
    return { ...row, sectionId, courseId: (typeof row.courseId === "object" && row.courseId?.name ? row.courseId : section?.courseId) || { name: "Unknown course" }, teacherId: teacher };
  });
};

function ClassSchedule() {
  const [state, setState] = useState({ status: "loading" });
  const [mode, setMode] = useState("all");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [layout, setLayout] = useState("week");              // inside "All": the whole week, or one day by room
  const [filter, setFilter] = useState({ departmentId: "", programId: "", semester: "" });     // inside "All": limit to a department, degree, semester
  const [day, setDay] = useState(() => { const today = new Date().toLocaleDateString("en-US", { weekday: "long" }); return DAYS.includes(today) ? today : "Monday"; });
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null);                // { schedule, defaults }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const term = await axios.get(`${apiUrl}/api/academic-years/current`, { headers: authHeaders() }).then((r) => r.data).catch(() => null);
      const termId = idOf(term?._id);
      const [sectionsResponse, teachersResponse, offerings] = await Promise.all([
        axios.get(`${apiUrl}/api/sections`, { headers: authHeaders(), params: { populate: "true", deep: "true" } }),
        axios.get(`${apiUrl}/api/teachers`, { headers: authHeaders() }),
        axios.get(`${apiUrl}/api/course-offerings`, { headers: authHeaders(), params: { isActive: "true" } }).then((r) => (Array.isArray(r.data) ? r.data : r.data?.offerings || [])).catch(() => []),   // only powers the semester view and its warning
      ]);
      // Only the active term's courses: a section says which term it belongs to; an older one that does not is placed by its course offering.
      const offeringTerm = new Map(offerings.map((o) => [idOf(o), idOf(o.academicYearId)]));
      const inTerm = (section) => {
        if (!termId) return true;
        const own = idOf(section.academicTermId) || offeringTerm.get(idOf(section.courseOfferingId));
        return !own || own === termId;
      };
      const sections = (sectionsResponse.data || []).filter(inTerm);
      const teachers = teachersResponse.data || [];
      const schedules = await loadSchedules(sections, teachers);
      setState({ status: "ready", sections, teachers, schedules, term, cohorts: cohortsBySection(sections, offerings.filter((o) => !termId || idOf(o.academicYearId) === termId)) });
    } catch (error) {
      setState({ status: "error", message: messageOf(error, "Failed to fetch the timetable") });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const model = useMemo(() => {
    if (state.status !== "ready") return null;
    const { sections, teachers, schedules, cohorts } = state;
    const options = entityOptions(mode, { sections, teachers, schedules, cohorts });
    const chosen = options.some((o) => o.value === entity) ? entity : options[0]?.value || "";
    const needle = search.trim().toLowerCase();
    const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.value === chosen) : options;
    const sectionById = new Map(sections.map((s) => [idOf(s), s]));
    const visible = mode === "all"
      ? schedules.filter((s) => matchesCohortFilter(idOf(s.sectionId), cohorts, filter))
      : schedules.filter(matchesEntity(mode, chosen, cohorts, teachersBySection(sections)));
    return {
      options: shown, chosen, sectionById,
      visible, filterOptions: cohortFilterOptions(cohorts, filter),
      days: visibleDays(schedules), axis: axisOf(visible), colors: courseColors(schedules),
      clashIds: clashingIds(schedules), overlapIds: cohortOverlapIds(schedules, cohorts), unscheduled: sectionsWithoutClasses(sections, schedules).filter((section) => mode !== "all" || matchesCohortFilter(idOf(section), cohorts, filter)),
    };
  }, [state, mode, entity, search, filter]);

  if (state.status === "loading") return <div className="class-schedule-page page-shell"><PageHeader title="Class Schedule" subtitle="The weekly timetable of every section." /><Loading variant="table" rows={6} label="Loading the timetable" /></div>;
  if (state.status === "error") {
    return (
      <div className="class-schedule-page page-shell">
        <PageHeader title="Class Schedule" subtitle="The weekly timetable of every section." />
        <div className="cs-card"><ErrorState message={state.message} title={state.message === NETWORK_MESSAGE ? undefined : "The timetable could not be loaded"} onRetry={load} /></div>
      </div>
    );
  }

  const { sections, teachers, schedules, term, cohorts } = state;
  const { filterOptions, options, chosen, sectionById, visible, days, axis, colors, clashIds, overlapIds, unscheduled } = model;
  const termLabel = term?.displayName || (term?.semesterType && term?.year ? `${term.semesterType} ${term.year}` : "");
  const sectionLetter = (schedule) => sectionById.get(idOf(schedule.sectionId))?.section || "";
  const teacherLabel = (schedule) => (teacherName(schedule.teacherId) || "").replace(/^(Dr|Mr|Ms|Mrs|Prof)\.? /i, "");
  const classLabel = (schedule) => `${schedule.courseId?.name || "a class"}${sectionLetter(schedule) ? ` (${sectionLetter(schedule)})` : ""}`;
  const selected = schedules.find((s) => String(s._id) === selectedId) || null;
  const selectedClashes = selected ? clashesFor(selected, schedules, selected._id) : [];
  const selectedOverlaps = selected ? cohortOverlapsFor(selected, schedules, cohorts, selected._id) : [];

  const chooseMode = (next) => { setMode(next); setEntity(""); setSearch(""); setSelectedId(null); };
  const showClash = () => {
    const first = schedules.find((s) => clashIds.has(String(s._id))) || schedules.find((s) => overlapIds.has(String(s._id)));
    if (!first) return;
    setMode("section"); setEntity(idOf(first.sectionId)); setSearch(""); setSelectedId(String(first._id));
  };
  const openAdd = (dayName, start, room, forSection) => {
    const from = start ?? axis.start;
    setDialog({ schedule: null, defaults: {
      day: dayName || (mode === "all" && layout === "rooms" ? day : "Monday"), start: timeOf(from), end: timeOf(from + DEFAULT_LENGTH),
      sectionId: forSection || (mode === "section" ? chosen : ""), room: room || (mode === "room" ? chosen : ""), teacherId: mode === "teacher" ? chosen : "",
    } });
  };

  const academicYear = termLabel || new Date().getFullYear().toString();
  const saveClass = async (draft, editing) => {
    const section = sections.find((s) => idOf(s) === draft.sectionId);
    const payload = { day: draft.day, timeSlot: { startTime: draft.start, endTime: draft.end, room: draft.room }, teacherId: draft.teacherId, sectionId: draft.sectionId, courseId: section?.courseId?._id, semester: 1, academicYear };
    try {
      // The server has the last word on clashes: it sees every class, even ones added a moment ago by someone else.
      const check = await axios.post(`${apiUrl}/api/section-schedules/check-conflicts`, { ...payload, ...(editing ? { excludeScheduleId: editing._id } : {}) }, { headers: authHeaders() });
      if (check.data?.conflicts?.length) return check.data.conflicts.map((c) => c.message).join(" ");
      if (editing) await axios.put(`${apiUrl}/api/section-schedules/${editing._id}`, payload, { headers: authHeaders() });
      else await axios.post(`${apiUrl}/api/section-schedules`, payload, { headers: authHeaders() });
      const fresh = await loadSchedules(sections, teachers);
      setState((current) => ({ ...current, schedules: fresh }));
      setDialog(null);
      showToast(editing ? "Class updated" : "Class added", TOAST_TYPES.SUCCESS);
      return null;
    } catch (error) {
      return messageOf(error, editing ? "Failed to update the class" : "Failed to add the class");
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${apiUrl}/api/section-schedules/${toDelete._id}`, { headers: authHeaders() });
      const fresh = await loadSchedules(sections, teachers);
      setState((current) => ({ ...current, schedules: fresh }));
      setSelectedId(null);
      showToast("Class deleted", TOAST_TYPES.SUCCESS);
    } catch (error) {
      showToast(messageOf(error, "Failed to delete the class"), TOAST_TYPES.ERROR);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div className="class-schedule-page page-shell">
      <PageHeader
        title="Class Schedule"
        subtitle="The weekly timetable of every section. Choose what to look at, click a class for its details, or click an empty slot to add one."
        actions={<>{termLabel && <span className="cs-term">{termLabel}</span>}<button type="button" className="am-btn am-btn-primary" onClick={() => openAdd()} disabled={sections.length === 0}>+ Add class</button></>}
      />

      {(clashIds.size > 0 || overlapIds.size > 0 || unscheduled.length > 0) && (
        <div className="cs-health" role="status">
          <span>{[clashIds.size > 0 && `${classes(clashIds.size)} clash`, overlapIds.size > 0 && `${classes(overlapIds.size)} overlap for a semester`, unscheduled.length > 0 && `${unscheduled.length} ${unscheduled.length === 1 ? "section has" : "sections have"} no timetable yet`].filter(Boolean).join(" · ")}</span>
          <span className="cs-health-actions">
            {unscheduled.length > 0 && <button type="button" className="cs-link" aria-expanded={showMissing} onClick={() => setShowMissing(!showMissing)}>{showMissing ? "Hide sections without a timetable" : "See which sections"}</button>}
            {(clashIds.size > 0 || overlapIds.size > 0) && <button type="button" className="cs-link" onClick={showClash}>{clashIds.size > 0 ? "Show the clash" : "Show the overlap"}</button>}
          </span>
        </div>
      )}

      {showMissing && unscheduled.length > 0 && (
        <section className="cs-card cs-missing" aria-label="Sections without a timetable">
          <h3>Sections without a timetable <span>{unscheduled.length}</span></h3>
          <ul>
            {[...unscheduled].sort((a, b) => sectionLabel(a).localeCompare(sectionLabel(b), undefined, { numeric: true })).map((section) => (
              <li key={idOf(section)}>
                <div><strong>{sectionLabel(section)}</strong><span className="cs-note">{[(cohorts?.get(idOf(section)) || []).map((c) => c.label).join(", "), formatSectionTeachers(section)].filter(Boolean).join(" · ")}</span></div>
                <button type="button" className="am-btn" onClick={() => openAdd(undefined, undefined, undefined, idOf(section))}>Add class</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cs-tools">
        <div className="cs-seg" role="group" aria-label="Look at">
          {MODES.map(([key, label]) => <button type="button" key={key} className={mode === key ? "is-on" : ""} aria-pressed={mode === key} onClick={() => chooseMode(key)}>{label}</button>)}
        </div>
        {mode === "all" ? (
          <>
            <div className="cs-seg" role="group" aria-label="Layout">
              <button type="button" className={layout === "week" ? "is-on" : ""} aria-pressed={layout === "week"} onClick={() => setLayout("week")}>Week</button>
              <button type="button" className={layout === "rooms" ? "is-on" : ""} aria-pressed={layout === "rooms"} onClick={() => setLayout("rooms")}>By room</button>
            </div>
            {layout === "rooms" && <div className="cs-seg" role="group" aria-label="Day">{days.map((name) => <button type="button" key={name} className={day === name ? "is-on" : ""} aria-pressed={day === name} onClick={() => { setDay(name); setSelectedId(null); }}>{name.slice(0, 3)}</button>)}</div>}
          </>
        ) : (
          <>
            <input type="search" className="cs-search" placeholder={`Search ${mode}s…`} value={search} onChange={(event) => setSearch(event.target.value)} aria-label={`Search ${mode}s`} />
            <select className="cs-entity" value={chosen} onChange={(event) => { setEntity(event.target.value); setSelectedId(null); }} aria-label={`Choose a ${mode}`}>
              {options.length === 0 && <option value="">Nothing matches</option>}
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </>
        )}
        {mode !== "all" && <span className="cs-note">{classes(visible.length)} this week</span>}
      </div>

      {mode === "all" && (
        <div className="cs-filterbar" role="group" aria-label="Filter classes">
          <span className="cs-filterbar-title">Filter by</span>
          <FilterPick label="Department" allLabel="All departments" value={filter.departmentId} options={filterOptions.departments} onChange={(value) => { setFilter({ departmentId: value, programId: "", semester: "" }); setSelectedId(null); }} />
          <FilterPick label="Degree" allLabel="All degrees" value={filter.programId} options={filterOptions.programs} onChange={(value) => { setFilter({ ...filter, programId: value, semester: "" }); setSelectedId(null); }} />
          <FilterPick label="Semester" allLabel="All semesters" value={filter.semester} options={filterOptions.semesters} onChange={(value) => { setFilter({ ...filter, semester: value }); setSelectedId(null); }} />
          {hasCohortFilter(filter) && <button type="button" className="cs-clear" onClick={() => setFilter({ departmentId: "", programId: "", semester: "" })}>Clear all</button>}
          <span className="cs-result">{layout === "rooms" ? `${classes(visible.filter((c) => c.day === day).length)} on ${day}` : `${classes(visible.length)} this week`}</span>
        </div>
      )}

      {mode === "all" && layout === "rooms" ? (
        <RoomBoard
          day={day} axis={axis} schedules={visible} colors={colors} courseKeyOf={courseKey} selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)} onAddAt={openAdd} sectionLabel={sectionLetter} teacherLabel={teacherLabel}
        />
      ) : <WeekBoard
        days={days} axis={axis} schedules={visible} allSchedules={schedules} colors={colors} courseKeyOf={courseKey} mode={mode}
        selectedId={selectedId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} onAddAt={openAdd}
        sectionLabel={sectionLetter} teacherLabel={teacherLabel}
      />}

      {selected && (
        <section className="cs-card cs-details" aria-label="Selected class">
          <div className="cs-details-top">
            <div>
              <strong>{selected.courseId?.name || "Class"}{sectionLetter(selected) ? ` · Section ${sectionLetter(selected)}` : ""}</strong>
              <span className="cs-note">{selected.day} · {to12Hour(selected.timeSlot.startTime)} – {to12Hour(selected.timeSlot.endTime)} · {selected.timeSlot.room || "No room"} · {teacherName(selected.teacherId) || "No teacher"}</span>
              {formatSectionTeachers(sectionById.get(idOf(selected.sectionId))).includes(",") && <span className="cs-note">Section teachers: {formatSectionTeachers(sectionById.get(idOf(selected.sectionId)))}</span>}
            </div>
            <div className="cs-details-actions">
              <button type="button" className="am-btn" onClick={() => setDialog({ schedule: selected, defaults: {} })}>Edit</button>
              <button type="button" className="am-btn am-btn-danger" onClick={() => setToDelete(selected)}>Delete</button>
            </div>
          </div>
          {selectedClashes.length > 0 && <div className="cs-check is-bad" role="alert">{selectedClashes.map((clash, index) => <p key={index}>{clashSentence(clash, classLabel)}</p>)}</div>}
          {selectedOverlaps.length > 0 && <div className="cs-check is-warn" role="status">{selectedOverlaps.map((w, index) => <p key={index}>{cohortSentence(w, classLabel)}.</p>)}</div>}
        </section>
      )}

      {dialog && (
        <ScheduleModal
          schedule={dialog.schedule} defaults={dialog.defaults} sections={sections} teachers={teachers} schedules={schedules} cohorts={cohorts}
          onSave={saveClass} onClose={() => setDialog(null)} classLabel={classLabel}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Delete class"
          body={`Delete the ${toDelete.day} ${to12Bare(toDelete.timeSlot.startTime)}–${to12Hour(toDelete.timeSlot.endTime)} class of ${toDelete.courseId?.name || "this section"} from the timetable? This cannot be undone.`}
          confirmLabel="Delete class" busyText="Deleting…" danger busy={deleting}
          onConfirm={confirmDelete} onClose={() => !deleting && setToDelete(null)}
        />
      )}
    </div>
  );
}

export default ClassSchedule;
