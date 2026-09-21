import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import EligibilityPreview from "./EligibilityPreview";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const check = (rule, status, message) => ({ rule, status, message, detail: {} });
const failedPrereq = {
  rollNumber: "R-FAIL", section: "A", sectionFound: true, verdict: "NEEDS_OVERRIDE",
  message: "Locked. Requires CS101 at grade D or better. Your last attempt at CS101 was F in Fall 2025.",
  checks: [check("PREREQ", "FAIL", "Locked. Requires CS101 at grade D or better."), check("NOT_DUPLICATE", "PASS", "Not already registered this term.")],
};
const answer = {
  courseOfferingId: "offering-1",
  summary: { total: 3, eligible: 1, needsOverride: 1, blocked: 1, pendingResults: 0, notFound: 0 },
  results: [
    { rollNumber: "R-GOOD", section: "A", sectionFound: true, verdict: "ELIGIBLE", message: "Eligible.", checks: [] },
    failedPrereq,
    { rollNumber: "R-DUP", section: "A", sectionFound: true, verdict: "BLOCKED", message: "Already registered for CS201 this term.", checks: [check("NOT_DUPLICATE", "FAIL", "Already registered for CS201 this term.")] },
  ],
};

let container; let root;
const props = { apiUrl: "http://api", courseId: "c1", semester: "2", academicYear: "t1", students: [{ rollNumber: "R-GOOD", section: "A" }, { rollNumber: "R-FAIL", section: "A" }, { rollNumber: "R-DUP", section: "A" }], headers: { Authorization: "Bearer x" } };
const render = async (extra = {}) => { await act(async () => { root.render(<EligibilityPreview {...props} {...extra} />); }); };
const click = async (element) => { await act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };
const button = (label) => [...container.querySelectorAll("button")].find((b) => b.textContent.includes(label));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  axios.get.mockReset(); axios.post.mockReset();
  axios.get.mockResolvedValue({ data: { flags: [{ key: "eligibilityEngine", enabled: true }] } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("nothing is asked until the admin presses Check eligibility, and the list is sent as roll numbers and sections", async () => {
  axios.post.mockResolvedValue({ data: answer });
  await render();
  expect(axios.post).not.toHaveBeenCalled();
  await click(button("Check eligibility"));
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, body] = axios.post.mock.calls[0];
  expect(url).toBe("http://api/api/admin/eligibility/preview");
  expect(body).toEqual({ courseId: "c1", semester: 2, academicYear: "t1", rows: [{ rollNumber: "R-GOOD", section: "A" }, { rollNumber: "R-FAIL", section: "A" }, { rollNumber: "R-DUP", section: "A" }] });
});

test("each student gets a plain-language verdict and the reason, and the counts are summarised", async () => {
  axios.post.mockResolvedValue({ data: answer });
  await render();
  await click(button("Check eligibility"));
  const text = container.textContent;
  expect(text).toContain("1 can enrol");
  expect(text).toContain("1 needs an exception");
  expect(text).toContain("1 cannot enrol");
  expect(text).toContain("Your last attempt at CS101 was F in Fall 2025.");
  expect(text).toContain("Already registered for CS201 this term.");
});

test("only a student held back by a rule that allows an exception can be given one", async () => {
  axios.post.mockResolvedValue({ data: answer });
  await render();
  await click(button("Check eligibility"));
  const grantButtons = [...container.querySelectorAll("button")].filter((b) => b.textContent.startsWith("Grant exception"));
  expect(grantButtons).toHaveLength(1);
  expect(grantButtons[0].closest("tr").textContent).toContain("R-FAIL");
});

test("an exception needs a real reason, records one waiver per failing rule, then checks again", async () => {
  axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/preview") ? answer : { id: "o1" } }));
  await render();
  await click(button("Check eligibility"));
  await click(button("Grant exception…"));
  const submit = [...container.querySelectorAll("button")].find((b) => b.textContent === "Grant exception");
  expect(submit.disabled).toBe(true);

  const box = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "Approved by the head of department");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(submit.disabled).toBe(false);
  await click(submit);

  const overrideCalls = axios.post.mock.calls.filter(([url]) => url.endsWith("/enrollment-overrides"));
  expect(overrideCalls).toHaveLength(1);
  expect(overrideCalls[0][1]).toEqual({ studentId: "R-FAIL", courseOfferingId: "offering-1", ruleWaived: "PREREQ", reason: "Approved by the head of department" });
  expect(axios.post.mock.calls.filter(([url]) => url.endsWith("/preview"))).toHaveLength(2);       // the check ran again
});

test("the checks behind a verdict can be opened, showing each rule", async () => {
  axios.post.mockResolvedValue({ data: answer });
  await render();
  await click(button("Check eligibility"));
  await click(button("All checks"));
  expect(container.textContent).toContain("Prerequisites:");
  expect(container.textContent).toContain("Not already registered:");
});

test("when the rules are not switched on yet the admin is told so, so a green result is not mistaken for enforcement", async () => {
  axios.get.mockResolvedValue({ data: { flags: [{ key: "eligibilityEngine", enabled: false }] } });
  await render();
  expect(container.textContent).toContain("not being enforced yet");
});

test("a failure to check shows a message and does not break the screen", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "Course is not offered for semester 2" } } });
  await render();
  await click(button("Check eligibility"));
  expect(container.querySelector('[role="alert"]').textContent).toContain("Course is not offered for semester 2");
});

test("a new list clears the previous answer", async () => {
  axios.post.mockResolvedValue({ data: answer });
  await render();
  await click(button("Check eligibility"));
  expect(container.textContent).toContain("R-FAIL");
  await render({ students: [{ rollNumber: "R-NEW", section: "B" }] });
  expect(container.textContent).not.toContain("R-FAIL");
});
