import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';
import type { JobStatus } from './digest/types.js';

// Jobs per last status. null when the night can't be read: views show `—`.
export type NightSummary = { night: string; counts: Record<JobStatus, number> | null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const read = readNight(runsDir, night);
  if (!read) return { night, counts: null };
  const counts: Record<JobStatus, number> = { ok: 0, retry: 0, fail: 0 };
  for (const row of read.rows) counts[row.lastStatus]++;
  return { night, counts };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
