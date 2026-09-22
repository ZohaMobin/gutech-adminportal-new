import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { FiX, FiCheck, FiPlus, FiEdit2, FiSearch, FiUser } from 'react-icons/fi';
import Loading, { BusyLabel, Refreshing } from '../../Components/Loading/Loading';
import { messageOf } from '../../utils/apiMessage';
import './TeacherAssignmentPage.css';

// Who teaches which section. Everything for the current term is listed by course; choosing a course opens its sections on the
// right, where teachers are added, removed and saved. Filters start on "all" so nothing is hidden until you narrow it down.
const idOf = (value) => String(value?._id ?? value ?? '');
const teacherName = (teacher) => teacher?.userId?.name || teacher?.userId?.email || 'Unknown teacher';
const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const getAssignedTeacherIds = (section) => {
  if (Array.isArray(section.teachers) && section.teachers.length > 0) return section.teachers.map((teacher) => teacher.id);
  if (section.teacher?.id) return [section.teacher.id];
  return [];
};
const arraysEqual = (left = [], right = []) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);

const TeacherChip = ({ teacher, onRemove }) => (
  <span className="ta-chip">
    <span className="ta-avatar" aria-hidden="true">{initials(teacherName(teacher))}</span>
    <span className="ta-chip-name">{teacherName(teacher)}<small>{teacher.employeeId || ''}</small></span>
    {onRemove && <button type="button" className="ta-chip-x" onClick={() => onRemove(teacher._id)} aria-label={`Remove ${teacherName(teacher)}`}><FiX /></button>}
  </span>
);

// Chosen teachers as chips, and one dropdown to add another.
const TeacherPicker = ({ teachers, selectedTeacherIds, onAddTeacher, onRemoveTeacher }) => {
  const available = useMemo(() => teachers.filter((teacher) => !selectedTeacherIds.includes(teacher._id)), [teachers, selectedTeacherIds]);
  const selected = teachers.filter((teacher) => selectedTeacherIds.includes(teacher._id));
  return (
    <div className="ta-picker">
      <div className="ta-chips">
        {selected.length ? selected.map((teacher) => <TeacherChip key={teacher._id} teacher={teacher} onRemove={onRemoveTeacher} />) : <span className="ta-none">No teacher yet</span>}
      </div>
      <select className="ta-add-select" value="" onChange={(e) => { if (e.target.value) onAddTeacher(e.target.value); }} disabled={available.length === 0} aria-label="Add a teacher">
        <option value="">{available.length ? '+ Add a teacher' : 'No more teachers to add'}</option>
        {available.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacherName(teacher)} ({teacher.employeeId || 'N/A'})</option>)}
      </select>
    </div>
  );
};

const SectionCard = ({ section, teachers, onAssign, saving }) => {
  const initial = useMemo(() => getAssignedTeacherIds(section), [section]);
  const [ids, setIds] = useState(initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setIds(initial); setEditing(false); }, [initial]);
  const assigned = teachers.filter((teacher) => ids.includes(teacher._id));
  const changed = !arraysEqual(ids, initial);
  return (
    <div className={`ta-section ${initial.length === 0 ? 'needs' : ''} ${editing ? 'editing' : ''}`}>
      <div className="ta-section-head">
        <strong>Section {section.section}</strong>
        {initial.length === 0 && <span className="ta-flag">Needs a teacher</span>}
        {!editing && <button type="button" className="ta-link" onClick={() => setEditing(true)}><FiEdit2 /> {initial.length ? 'Change' : 'Assign'}</button>}
      </div>
      {!editing ? (
        <div className="ta-chips">{assigned.length ? assigned.map((teacher) => <TeacherChip key={teacher._id} teacher={teacher} />) : <span className="ta-none">No teacher assigned yet</span>}</div>
      ) : (
        <>
          <TeacherPicker teachers={teachers} selectedTeacherIds={ids} onAddTeacher={(id) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))} onRemoveTeacher={(id) => setIds((prev) => prev.filter((x) => x !== id))} />
          <div className="ta-actions">
            <button type="button" className="ta-btn" onClick={() => { setIds(initial); setEditing(false); }} disabled={saving}>Cancel</button>
            <button type="button" className="ta-btn ta-primary" onClick={() => onAssign(section, ids)} disabled={!changed || ids.length === 0 || saving}><BusyLabel busy={saving} busyText="Saving…" idle="Save" /></button>
          </div>
        </>
      )}
    </div>
  );
};

const TeacherAssignmentPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const headers = useCallback(() => {
    const token = sessionStorage.getItem('adminToken');
    return { 'x-auth-token': token, Authorization: `Bearer ${token}` };
  }, []);

  const [term, setTerm] = useState(undefined);              // undefined: loading, null: none
  const [offerings, setOfferings] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [overview, setOverview] = useState({});              // courseId -> { sections, unassigned }
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [department, setDepartment] = useState('');
  const [program, setProgram] = useState('');
  const [semester, setSemester] = useState('');
  const [query, setQuery] = useState('');
  const [onlyNeeds, setOnlyNeeds] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [newSection, setNewSection] = useState({ section: '', teacherIds: [] });
  const started = useRef(false);
  const sectionRequest = useRef(0);

  const loadOverview = useCallback(async (termId) => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/sections/assignment-overview`, { params: { academicYearId: termId }, headers: headers() });
      setOverview(Object.fromEntries((data.items || []).map((item) => [item.courseId, item])));
    } catch { setOverview({}); }
  }, [apiUrl, headers]);

  // Once: the term, its offerings, the teachers, and how far assignment has got.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data: current } = await axios.get(`${apiUrl}/api/academic-years/current`, { headers: headers() });
        setTerm(current);
        const [offeringsResponse, teachersResponse] = await Promise.all([
          axios.get(`${apiUrl}/api/course-offerings`, { params: { academicYearId: current._id, isActive: true }, headers: headers() }),
          axios.get(`${apiUrl}/api/teachers`, { headers: headers() }),
        ]);
        setOfferings(Array.isArray(offeringsResponse.data) ? offeringsResponse.data : []);
        setTeachers(Array.isArray(teachersResponse.data) ? teachersResponse.data : []);
        loadOverview(current._id);
      } catch (err) {
        setTerm((known) => (known === undefined ? null : known));
        setOfferings((known) => known || []);
        setError(messageOf(err, 'No active academic term is configured.'));
      }
    })();
  }, [apiUrl, headers, loadOverview]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  // A course offering is one program-and-semester slot a course is taught in; a course with two offerings this
  // term (e.g. a gen-ed course taken by both Sem 3 and Sem 5) is still ONE course with ONE shared set of
  // sections - not two courses to assign separately. Group offerings by course before listing them.
  const courses = useMemo(() => {
    const byCourse = new Map();
    for (const o of (offerings || [])) {
      if (!o.courseId?._id) continue;
      const courseId = o.courseId._id;
      const slot = {
        offeringId: o._id,
        departmentId: idOf(o.department), departmentName: o.department?.name || '',
        programId: idOf(o.program), programCode: o.program?.code || o.program?.name || '', programName: o.program?.name || '',
        semester: o.semester,
      };
      if (!byCourse.has(courseId)) byCourse.set(courseId, { key: courseId, courseId, code: o.courseId.code, name: o.courseId.name, slots: [slot] });
      else byCourse.get(courseId).slots.push(slot);
    }
    return [...byCourse.values()];
  }, [offerings]);
  const departmentOptions = useMemo(() => [...new Map(courses.flatMap((c) => c.slots).filter((s) => s.departmentId).map((s) => [s.departmentId, s.departmentName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [courses]);
  const programOptions = useMemo(() => [...new Map(courses.flatMap((c) => c.slots).filter((s) => !department || s.departmentId === department).filter((s) => s.programId).map((s) => [s.programId, s.programName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [courses, department]);
  const semesterOptions = useMemo(() => [...new Set(courses.flatMap((c) => c.slots).filter((s) => (!department || s.departmentId === department) && (!program || s.programId === program)).map((s) => Number(s.semester)))].sort((a, b) => a - b), [courses, department, program]);
  const needsOf = (course) => overview[course.courseId]?.unassigned || 0;
  // A course matches a department/program/semester filter if ANY of its slots do - it should not disappear
  // just because one of its several offerings falls outside the chosen filter.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((c) => c.slots.some((s) => (!department || s.departmentId === department) && (!program || s.programId === program) && (semester === '' || Number(s.semester) === Number(semester)))
      && (!onlyNeeds || needsOf(c) > 0 || !overview[c.courseId]) && (!needle || `${c.code} ${c.name}`.toLowerCase().includes(needle)))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, department, program, semester, query, onlyNeeds, overview]);
  // "BSCS · Sem 3, 5" for one program across several semesters; " · " joins entirely different programs.
  const slotLabel = (slots) => {
    const byProgram = new Map();
    for (const s of slots) {
      const label = s.programCode || s.programName || '';
      if (!byProgram.has(label)) byProgram.set(label, new Set());
      if (s.semester !== undefined) byProgram.get(label).add(Number(s.semester));
    }
    return [...byProgram.entries()].map(([prog, sems]) => (sems.size ? `${prog} · Sem ${[...sems].sort((a, b) => a - b).join(', ')}` : prog)).join(' · ');
  };
  const totalNeeds = Object.values(overview).reduce((n, item) => n + item.unassigned, 0);
  const selected = courses.find((c) => c.key === selectedKey) || null;

  const loadSections = useCallback(async (courseId) => {
    const token = ++sectionRequest.current;
    setLoadingSections(true);
    try {
      const { data } = await axios.get(`${apiUrl}/api/sections/course/${courseId}`, { params: { academicYearId: term?._id }, headers: headers() });
      if (token === sectionRequest.current) setSections(Array.isArray(data) ? data : []);
    } catch (err) {
      if (token === sectionRequest.current) { setSections([]); setError(messageOf(err, 'The sections could not be loaded.')); }
    } finally {
      if (token === sectionRequest.current) setLoadingSections(false);
    }
  }, [apiUrl, headers, term?._id]);

  const choose = (course) => {
    setSelectedKey(course.key); setSuccess(''); setError(''); setNewSection({ section: '', teacherIds: [] });
    loadSections(course.courseId);
  };

  const save = async (request, done) => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await request();
      setSuccess(done);
      await Promise.all([loadSections(selected.courseId), loadOverview(term?._id)]);
    } catch (err) {
      setError(messageOf(err, 'That could not be saved. Please try again.'));
    } finally { setSaving(false); }
  };
  const assign = (section, teacherIds) => save(() => axios.put(`${apiUrl}/api/sections/${section._id || section.id}`, { teacherId: teacherIds[0], teacherIds, section: section.section }, { headers: headers() }), `Section ${section.section} saved.`);
  const addSection = () => {
    const name = newSection.section.trim();
    if (!name || newSection.teacherIds.length === 0) return;
    save(async () => {
      await axios.post(`${apiUrl}/api/sections/addSection`, { courseId: selected.courseId, teacherId: newSection.teacherIds[0], teacherIds: newSection.teacherIds, section: name }, { headers: headers() });
      setNewSection({ section: '', teacherIds: [] });
    }, `Section ${name} added.`);
  };

  const clearFilters = () => { setDepartment(''); setProgram(''); setSemester(''); setQuery(''); setOnlyNeeds(false); };

  if (term === undefined || offerings === null) return <div className="ta"><Loading variant="page" rows={4} label="Loading courses" /></div>;
  if (term === null) return <div className="ta"><div className="ta-banner bad" role="alert">{error || 'There is no active academic term, so there is nothing to assign yet. Set one under Academic Years first.'}</div></div>;

  return (
    <div className="ta">
      <header className="ta-head">
        <div>
          <h2>Teacher assignments</h2>
          <p>Choose a course, then decide who teaches each of its sections. Term: <strong>{term.displayName || `${term.semesterType} ${term.year}`}</strong></p>
        </div>
        <span className={`ta-summary ${totalNeeds ? 'warn' : 'ok'}`}>{totalNeeds ? `${totalNeeds} section${totalNeeds === 1 ? '' : 's'} still need a teacher` : 'Every section has a teacher'}</span>
      </header>

      {error && <div className="ta-banner bad" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss"><FiX /></button></div>}
      {success && <div className="ta-banner ok" role="status"><FiCheck />{success}</div>}

      <section className="ta-filters" aria-label="Find a course">
        <label><span>Department</span>
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setProgram(''); setSemester(''); }}>
            <option value="">All departments</option>
            {departmentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label><span>Program</span>
          <select value={program} onChange={(e) => { setProgram(e.target.value); setSemester(''); }}>
            <option value="">All programs</option>
            {programOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label><span>Semester</span>
          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="">All semesters</option>
            {semesterOptions.map((s) => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </label>
        <label className="ta-search"><span>Search</span>
          <span className="ta-input"><FiSearch aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Course code or name" /></span>
        </label>
        <button type="button" className={`ta-toggle ${onlyNeeds ? 'on' : ''}`} aria-pressed={onlyNeeds} onClick={() => setOnlyNeeds((v) => !v)}>Needs a teacher{totalNeeds ? <b>{totalNeeds}</b> : null}</button>
      </section>

      <div className="ta-layout">
        <aside className="ta-courses" aria-label="Courses">
          <h3>Courses <span className="ta-count">{visible.length === courses.length ? courses.length : `${visible.length} of ${courses.length}`}</span></h3>
          {courses.length === 0 ? <p className="ta-empty">No courses are offered in this term yet. Create course offerings first.</p>
            : visible.length === 0 ? <p className="ta-empty">No course matches. <button type="button" className="ta-link" onClick={clearFilters}>Clear filters</button></p>
              : (
                <ul>
                  {visible.map((course) => {
                    const info = overview[course.courseId];
                    const needs = info?.unassigned || 0;
                    return (
                      <li key={course.key}>
                        <button type="button" className={`ta-course ${selectedKey === course.key ? 'is-on' : ''}`} onClick={() => choose(course)} aria-pressed={selectedKey === course.key}>
                          <span className="ta-course-code">{course.code}</span>
                          <span className="ta-course-name">{course.name}</span>
                          <span className="ta-course-meta">{slotLabel(course.slots)}</span>
                          <span className={`ta-status ${!info ? 'none' : needs ? 'needs' : 'done'}`}>{!info ? 'No sections' : needs ? `${needs} need${needs === 1 ? 's' : ''} a teacher` : `${info.sections} section${info.sections === 1 ? '' : 's'} · assigned`}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
        </aside>

        <main className="ta-detail">
          {!selected ? (
            <div className="ta-placeholder"><FiUser size={30} /><p>Choose a course on the left to see its sections and assign teachers.</p></div>
          ) : (
            <>
              <div className="ta-detail-head">
                <div><span className="ta-course-code">{selected.code}</span><h3>{selected.name}</h3><p>{[[...new Set(selected.slots.map((s) => s.departmentName).filter(Boolean))].join(', '), slotLabel(selected.slots)].filter(Boolean).join(' · ')}</p></div>
              </div>
              {loadingSections ? <Loading variant="list" rows={2} label="Loading sections" /> : (
                <>
                  <Refreshing active={saving}>
                  <div className="ta-sections">
                    {sections.length ? sections.map((section) => <SectionCard key={section._id || section.id} section={section} teachers={teachers} onAssign={assign} saving={saving} />) : <p className="ta-empty">This course has no sections in this term yet. Add the first one below.</p>}
                  </div>
                  </Refreshing>
                  <section className="ta-add" aria-label="Add a section">
                    <h4><FiPlus /> Add a section</h4>
                    <div className="ta-add-row">
                      <label><span>Section name</span><input type="text" value={newSection.section} maxLength={20} onChange={(e) => setNewSection({ ...newSection, section: e.target.value })} placeholder="For example: A" /></label>
                      <div className="ta-add-teachers"><span>Teachers</span>
                        <TeacherPicker teachers={teachers} selectedTeacherIds={newSection.teacherIds}
                          onAddTeacher={(id) => setNewSection((prev) => ({ ...prev, teacherIds: prev.teacherIds.includes(id) ? prev.teacherIds : [...prev.teacherIds, id] }))}
                          onRemoveTeacher={(id) => setNewSection((prev) => ({ ...prev, teacherIds: prev.teacherIds.filter((x) => x !== id) }))} />
                      </div>
                      <button type="button" className="ta-btn ta-primary" onClick={addSection} disabled={saving || !newSection.section.trim() || newSection.teacherIds.length === 0}><BusyLabel busy={saving} busyText="Adding…" idle="Add section" /></button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default TeacherAssignmentPage;
