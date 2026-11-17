/**
 * Crash-safe baselines for isolated E2E specs that change shared state (settings, theme publication, drafts).
 *
 * A spec records the state it is about to change in `.isolated/run-guard/<name>.json` BEFORE changing anything and
 * deletes the file only after its teardown restored that state. If a run dies part-way (process crash, closed browser,
 * expired token after machine sleep, network failure), the file survives; the next run then restores the recorded
 * baseline first and reuses it, instead of mistaking the leftover state for the baseline.
 *
 * Local test fixtures only: callers must have passed assertLocalOnly().
 */
import fs from "fs";
import path from "path";

const DIR = ".isolated/run-guard";

export type Guarded<T> = { baseline: T; recoveredFromInterruptedRun: boolean };

/**
 * Begin a guarded run. `capture` reads the current state; `restore` puts a recorded baseline back.
 * Returns the baseline to restore at the end of this run.
 */
export async function beginGuardedRun<T>(
  name: string,
  capture: () => Promise<T>,
  restore: (baseline: T) => Promise<void>,
): Promise<Guarded<T>> {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${name}.json`);
  if (fs.existsSync(file)) {
    const prev = JSON.parse(fs.readFileSync(file, "utf8")) as { baseline: T; startedAt: string };
    await restore(prev.baseline);
    fs.writeFileSync(file, JSON.stringify({ baseline: prev.baseline, startedAt: new Date().toISOString(), recovered: prev.startedAt }, null, 2));
    return { baseline: prev.baseline, recoveredFromInterruptedRun: true };
  }
  const baseline = await capture();
  fs.writeFileSync(file, JSON.stringify({ baseline, startedAt: new Date().toISOString() }, null, 2));
  return { baseline, recoveredFromInterruptedRun: false };
}

/** Call at the very end of teardown, after the baseline was restored successfully. */
export function endGuardedRun(name: string) {
  fs.rmSync(path.join(DIR, `${name}.json`), { force: true });
}
