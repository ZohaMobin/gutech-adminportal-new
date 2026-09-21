// Waits for a server job to finish without hammering the server. It asks for PROGRESS only (a few bytes), starts quickly so
// a short job feels instant, then backs off, and slows right down while the browser tab is hidden (the job keeps running on
// the server whether or not anyone is watching). The caller fetches the full report once, at the end.
export const TERMINAL = ["done", "failed", "interrupted"];
export const DELAYS = [1000, 1500, 2000, 3000, 5000];
export const HIDDEN_DELAY = 10000;

export async function pollJob({
  fetchProgress,
  onProgress,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  hidden = () => typeof document !== "undefined" && document.hidden,
  now = Date.now,
  maxMs = 15 * 60 * 1000,
}) {
  const started = now();
  let step = 0;
  for (;;) {
    const job = await fetchProgress();
    if (onProgress) onProgress(job);
    if (TERMINAL.includes(job.status)) return { job, timedOut: false };
    if (now() - started > maxMs) return { job, timedOut: true };
    await sleep(hidden() ? HIDDEN_DELAY : DELAYS[Math.min(step, DELAYS.length - 1)]);
    step += 1;
  }
}
