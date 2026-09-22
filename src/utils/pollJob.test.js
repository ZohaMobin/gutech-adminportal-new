import { pollJob, DELAYS, HIDDEN_DELAY } from "./pollJob";

const jobs = (...statuses) => { let i = 0; return jest.fn(async () => ({ status: statuses[Math.min(i++, statuses.length - 1)], processed: i, total: 10 })); };

test("a job that is already finished is asked about once, with no waiting", async () => {
  const sleep = jest.fn(); const fetchProgress = jobs("done");
  const { job, timedOut } = await pollJob({ fetchProgress, sleep });
  expect([job.status, timedOut, fetchProgress.mock.calls.length, sleep.mock.calls.length]).toEqual(["done", false, 1, 0]);
});

test("it starts quickly and then backs off, up to a cap", async () => {
  const delays = []; const fetchProgress = jobs(...Array(9).fill("running"), "done");
  await pollJob({ fetchProgress, sleep: async (ms) => { delays.push(ms); } });
  expect(delays).toEqual([400, 800, 1500, 2500, 4000, 4000, 4000, 4000, 4000]);
  expect(delays[0]).toBe(DELAYS[0]);
  expect(Math.max(...delays)).toBe(4000);
});

test("far fewer requests than a fixed one-second rhythm: a 60-second job takes about a dozen, not sixty", async () => {
  let clock = 0; let calls = 0;
  const fetchProgress = async () => { calls += 1; return { status: clock >= 60000 ? "done" : "running" }; };
  await pollJob({ fetchProgress, sleep: async (ms) => { clock += ms; }, now: () => clock });
  expect(calls).toBeLessThan(20);
});

test("while the tab is hidden it waits much longer between asks", async () => {
  const delays = []; let hiddenNow = true;
  const fetchProgress = jobs("running", "running", "running", "done");
  await pollJob({ fetchProgress, hidden: () => hiddenNow, sleep: async (ms) => { delays.push(ms); if (delays.length === 2) hiddenNow = false; } });
  expect(delays[0]).toBe(HIDDEN_DELAY);
  expect(delays[1]).toBe(HIDDEN_DELAY);
  expect(delays[2]).toBe(DELAYS[2]);                       // visible again: back to the normal rhythm, where it left off
});

test("progress is reported each time, and every ending state stops the wait", async () => {
  for (const ending of ["done", "failed", "interrupted"]) {
    const seen = []; const fetchProgress = jobs("running", ending);
    const { job } = await pollJob({ fetchProgress, sleep: async () => {}, onProgress: (j) => seen.push(j.status) });
    expect([job.status, seen]).toEqual([ending, ["running", ending]]);
  }
});

test("it gives up after the limit and says so, leaving the job to finish on the server", async () => {
  let clock = 0;
  const { job, timedOut } = await pollJob({ fetchProgress: async () => ({ status: "running" }), sleep: async (ms) => { clock += ms; }, now: () => clock, maxMs: 30000 });
  expect([timedOut, job.status]).toEqual([true, "running"]);
});
