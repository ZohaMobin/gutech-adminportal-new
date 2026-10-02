import PageHeader from "../../Components/PageHeader/PageHeader";
import Loading from "../../Components/Loading/Loading";
import SuperAdminOnly from "../../Components/SuperAdminOnly/SuperAdminOnly";
import useSuperAdmin from "../../hooks/useSuperAdmin";
import usePendingApprovals from "../../hooks/usePendingApprovals";
import TeachersPanel from "../Teachers/TeachersPage";
import AdministratorsPanel from "../Administrators/AdministratorsPage";
import AccountApprovalsPanel from "../AccountApprovals/AccountApprovalsPage";
import React from "react";
import { useSearchParams } from "react-router-dom";
import "../Administrators/AdministratorsPage.css";
import "./ManageAccessPage.css";

// Tab ids are what appears in the address (?tab=requests), so old links and the bell can point straight at one.
export const TABS = [
  { id: "teachers", label: "Teachers", Panel: TeachersPanel },
  { id: "administrators", label: "Administrators", Panel: AdministratorsPanel },
  { id: "requests", label: "Sign-up requests", Panel: AccountApprovalsPanel },
];

// Everything about who can sign in, in one place for the super admin: teachers (revoke, restore, delete), administrators,
// and staff who signed up and are waiting to be let in.
const Access = () => {
  const [params, setParams] = useSearchParams();
  const pending = usePendingApprovals(true);
  const current = TABS.find((t) => t.id === params.get("tab")) || TABS[0];

  return (
    <div className="ma-page page-shell">
      <PageHeader title="Manage access" subtitle="Who can sign in to the teacher and admin portals. Only you, as super admin, can see this page." />

      <div className="pk-tabs" role="tablist" aria-label="Manage access">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`ma-tab-${tab.id}`}
            aria-selected={current.id === tab.id}
            aria-controls="ma-panel"
            className={`pk-tab ${current.id === tab.id ? "is-on" : ""}`}
            onClick={() => setParams({ tab: tab.id }, { replace: true })}
          >
            {tab.label}
            {tab.id === "requests" && pending > 0 && <span className="ma-badge" aria-label={`${pending} waiting`}>{pending}</span>}
          </button>
        ))}
      </div>

      <div id="ma-panel" role="tabpanel" aria-labelledby={`ma-tab-${current.id}`}>
        <current.Panel />
      </div>
    </div>
  );
};

const ManageAccessPage = () => {
  const { isSuperAdmin, ready } = useSuperAdmin();
  if (!ready && !isSuperAdmin) return <div className="ma-page page-shell"><Loading variant="list" rows={4} label="Loading" /></div>;
  if (!isSuperAdmin) return <SuperAdminOnly title="Manage access" what="manage who can sign in" />;
  return <Access />;
};

export default ManageAccessPage;
