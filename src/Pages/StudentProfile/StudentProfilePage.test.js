import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import StudentProfilePage from "./StudentProfilePage";
import * as api from "../ManageEnrollment/enrollmentApi";

jest.mock("../ManageEnrollment/enrollmentApi", () => ({ ...jest.requireActual("../ManageEnrollment/enrollmentApi"), getEnrollment: jest.fn() }));
jest.mock("axios");
// react-router v7 can't be loaded by this test setup (the other tests stub it too). A small stand-in that keeps the
// current address, so tabs and the breadcrumb can be checked for real.
const mockRouter = { pathname: "/students/s1", search: "", state: null, listeners: new Set() };
const mockGo = (to, opts = {}) => {
  const [path, query = ""] = String(to).split("?");
  mockRouter.pathname = path; mockRouter.search = query ? `?${query}` : ""; mockRouter.state = opts.state ?? null;
  mockRouter.listeners.forEach((fn) => fn());
};
jest.mock("react-router-dom", () => {
  const React = require("react");
  const useRouter = () => { const [, force] = React.useState(0); React.useEffect(() => { const fn = () => force((n) => n + 1); mockRouter.listeners.add(fn); return () => mockRouter.listeners.delete(fn); }, []); return mockRouter; };
  return {
    useParams: () => ({ studentId: "s1" }),
    useNavigate: () => mockGo,
    useLocation: () => { const r = useRouter(); return { pathname: r.pathname, search: r.search, state: r.state }; },
    useSearchParams: () => {
      const r = useRouter();
      const params = new URLSearchParams(r.search);
      const set = (next, opts = {}) => { const value = typeof next === "function" ? next(params) : new URLSearchParams(next); mockGo(`${r.pathname}${value.toString() ? `?${value}` : ""}`, { state: opts.state ?? r.state }); };
      return [params, set];
    },
    Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  };
}, { virtual: true });
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error", WARNING: "warning" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const profile = (over = {}) => ({
  student: { id: "s1", rollNumber: "2622-6DSAI-023", name: "Muhammad Akif", program: { code: "MS DSAI", name: "MS Data Science and AI" }, currentSemester: 1, account: { status: "active" }, passwordIssuedAt: "2026-10-02T09:00:00Z", ...over },
  term: { label: "Fall 2026" },
  courses: [{ registrationId: "r1", status: "registered", course: { id: "ml", code: "AI301", name: "Machine Learning", creditHours: 3 }, section: { id: "a", name: "A", teachers: [] }, sections: [], attendanceRecords: 0, marks: 0, locked: false }],
  dropped: [], credits: 3, addDrop: null,
  history: [{ id: "h1", at: "2026-10-06T10:00:00Z", action: "enrollment.added", label: "Added", course: { code: "AI201", name: "Programming for AI and DS" }, toSection: "B", reason: "Academic Dept email", by: "Zoha Mobin" }],
});

let container; let root;
const where = { get pathname() { return mockRouter.pathname; }, get search() { return mockRouter.search; } };
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const tab = (name) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(name));
const visiblePanel = () => [...container.querySelectorAll('[role="tabpanel"]')].find((p) => !p.hidden);
const mount = async () => {
  mockRouter.pathname = "/students/s1"; mockRouter.search = ""; mockRouter.state = { from: "/student-directory?program=p1" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentProfilePage />); });
  await wait(10);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

test("the header shows who the student is, their status and this semester at a glance", async () => {
  api.getEnrollment.mockResolvedValue(profile());
  await mount();
  const head = container.querySelector(".pf-head").textContent;
  expect(head).toMatch(/Muhammad Akif/);
  expect(head).toMatch(/Active/);
  expect(head).toMatch(/2622-6DSAI-023 · MS Data Science and AI · Semester 1/);
  expect(head).toMatch(/Fall 2026 · 1 course · 3 credit hours/);
  expect(container.querySelector(".pf-crumbs").textContent).toMatch(/Student Directory.*Muhammad Akif/);
});

test("tabs switch the panel and are kept in the address; courses stay mounted", async () => {
  api.getEnrollment.mockResolvedValue(profile());
  await mount();
  expect(visiblePanel().id).toBe("pf-panel-courses");
  await click(tab("Password"));
  expect(where.search).toBe("?tab=password");
  expect(visiblePanel().textContent).toMatch(/2622-6DSAI-023/);
  expect(visiblePanel().textContent).toMatch(/Issued/);
  await click(tab("History"));
  expect(visiblePanel().textContent).toMatch(/Academic Dept email/);
  expect(container.querySelector("#pf-panel-courses").textContent).toMatch(/Machine Learning/);   // still there, just hidden
});

test("account actions live in the ⋯ menu: Deactivate for an active student", async () => {
  api.getEnrollment.mockResolvedValue(profile());
  await mount();
  await click(container.querySelector('[aria-label="Account actions"]'));
  const items = [...container.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
  expect(items).toEqual(["Deactivate…"]);
});

test("an inactive student shows why, and the menu offers Reactivate", async () => {
  api.getEnrollment.mockResolvedValue(profile({ account: { status: "inactive", categoryLabel: "Withdrew", deactivatedAt: "2026-10-08T09:00:00Z", note: "Letter dated 7 Oct" } }));
  await mount();
  const head = container.querySelector(".pf-head").textContent;
  expect(head).toMatch(/Inactive · Withdrew/);
  expect(head).toMatch(/Letter dated 7 Oct/);
  await click(container.querySelector('[aria-label="Account actions"]'));
  expect(container.querySelector('[role="menuitem"]').textContent).toBe("Reactivate…");
});

test("the breadcrumb goes back to the list the admin came from, filters included", async () => {
  api.getEnrollment.mockResolvedValue(profile());
  await mount();
  await click(container.querySelector(".pf-crumbs a"));
  expect(`${where.pathname}${where.search}`).toBe("/student-directory?program=p1");
});
