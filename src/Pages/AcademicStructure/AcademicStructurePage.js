import PageHeader from "../../Components/PageHeader/PageHeader";
import DepartmentsPanel from "../Departments/DepartmentsPage";
import ProgramsPanel from "../Programs/ProgramsPage";
import React from "react";
import { useSearchParams } from "react-router-dom";
import "./AcademicStructurePage.css";

// Tab ids are what appears in the address (?tab=programs), so old links can point straight at one.
export const TABS = [
  { id: "departments", label: "Departments", Panel: DepartmentsPanel },
  { id: "programs", label: "Programs", Panel: ProgramsPanel },
];

// The university's structure in one place: its departments, and the programs they offer. Two small lists that are set up
// once and changed rarely, and a program belongs to a department, so they sit side by side as tabs.
const AcademicStructurePage = () => {
  const [params, setParams] = useSearchParams();
  const current = TABS.find((t) => t.id === params.get("tab")) || TABS[0];

  return (
    <div className="as-page page-shell">
      <PageHeader title="Departments & Programs" subtitle="The departments of the university and the degree programs they offer." />

      <div className="pk-tabs" role="tablist" aria-label="Departments and programs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`as-tab-${tab.id}`}
            aria-selected={current.id === tab.id}
            aria-controls="as-panel"
            className={`pk-tab ${current.id === tab.id ? "is-on" : ""}`}
            onClick={() => setParams({ tab: tab.id }, { replace: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="as-panel" role="tabpanel" aria-labelledby={`as-tab-${current.id}`}>
        <current.Panel />
      </div>
    </div>
  );
};

export default AcademicStructurePage;
