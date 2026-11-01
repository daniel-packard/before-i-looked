// Plan morning-digest § 1. The contract between the run log reader (src/digest/read.ts, exported
// as `readNight`) and everything that shows a night: the digest page, its JSON, the board link.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  // null when the log says so. The row is kept; views show it as `—`.
  owner: string | null;
  // Lines logged for this job, retries included.
  runs: number;
  // Lines with status `retry`.
  retries: number;
  // Status of the job's latest line.
  lastStatus: JobStatus;
  // The job's most recent `error`, even if a later line was ok. null when it never logged one.
  lastError: string | null;
  // `at` of the job's earliest and latest line, exactly as logged (offset kept, never UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job, so every view shows the same order.
  rows: DigestRow[];
  // Lines that didn't parse, or parsed but weren't a run line. Counted, never thrown.
  badLines: number;
};

// Reads `<runsDir>/<night>.jsonl`. null when the night has no file (or isn't YYYY-MM-DD); an
// empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
