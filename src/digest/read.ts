import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight } from './types.js';

type RunLine = { at: string; time: number; job: string; status: JobStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies JobStatus[];

// The edge: anything that isn't a well-formed run line is null, and the caller counts it.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  return { at, time, job, status: status as JobStatus, owner: owner ?? null, error: error ?? null };
}

function toRow(lines: RunLine[]): DigestRow {
  // Order by instant, not by string: offsets can differ within a night. Stable sort keeps
  // file order for lines logged at the same instant.
  const byTime = [...lines].sort((a, b) => a.time - b.time);
  const first = byTime[0]!;
  const last = byTime[byTime.length - 1]!;
  const lastError = byTime.findLast((l) => l.error !== null)?.error ?? null;
  return {
    job: last.job,
    owner: last.owner,
    runs: byTime.length,
    retries: byTime.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export function parseNight(night: string, text: string): Night {
  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const lines = byJob.get(line.job);
    if (lines) lines.push(line);
    else byJob.set(line.job, [line]);
  }
  const rows = [...byJob.values()].map(toRow).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  // The night comes from a URL; only a date may name a file.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  return parseNight(night, text);
};
