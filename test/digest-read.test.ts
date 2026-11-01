import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNight, readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;

  it('has 5 jobs, sorted by job, and counts the 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('builds one row per job', () => {
    expect(night.rows).toEqual([
      { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
      { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
      { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held', firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
      { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded', firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
      { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
    ]);
  });
});

describe('readNight', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('is null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('is null for a night that is not a date', () => {
    writeFileSync(join(dir, 'x.jsonl'), '');
    expect(readNight(dir, 'x')).toBeNull();
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('reads a night of only bad lines without throwing', () => {
    writeFileSync(join(dir, '2026-01-03.jsonl'), '{"at":\nnot json\n');
    expect(readNight(dir, '2026-01-03')).toEqual({ night: '2026-01-03', rows: [], badLines: 2 });
  });
});

describe('parseNight', () => {
  const line = (o: object) => JSON.stringify(o);

  it('counts lines that parse but are not run lines', () => {
    const text = [
      line({ at: '2026-01-01T01:00:00+01:00', job: 'a', status: 'ok', owner: 'x' }),
      line({ at: '2026-01-01T01:00:00+01:00', job: 'a', status: 'done', owner: 'x' }),
      line({ at: 'yesterday', job: 'a', status: 'ok', owner: 'x' }),
      line({ at: '2026-01-01T01:00:00+01:00', status: 'ok', owner: 'x' }),
      line({ at: '2026-01-01T01:00:00+01:00', job: 'a', status: 'ok', owner: 7 }),
      '[]',
      'null',
    ].join('\n');
    const n = parseNight('2026-01-01', text);
    expect(n.badLines).toBe(6);
    expect(n.rows).toHaveLength(1);
  });

  it('skips blank lines without counting them', () => {
    const text = `\n${line({ at: '2026-01-01T01:00:00+01:00', job: 'a', status: 'ok', owner: 'x' })}\n\n  \n`;
    expect(parseNight('2026-01-01', text).badLines).toBe(0);
  });

  it('keeps a row whose owner is null or missing', () => {
    const text = [
      line({ at: '2026-01-01T01:00:00+01:00', job: 'a', status: 'ok', owner: null }),
      line({ at: '2026-01-01T01:00:00+01:00', job: 'b', status: 'ok' }),
    ].join('\n');
    expect(parseNight('2026-01-01', text).rows.map((r) => [r.job, r.owner])).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });

  it('orders a job by instant across offsets and keeps the logged offset', () => {
    const text = [
      line({ at: '2026-01-01T02:00:00+01:00', job: 'a', status: 'fail', owner: 'x', error: 'boom' }),
      // 02:30+01:00: latest by instant, though it sorts first as a string.
      line({ at: '2026-01-01T01:30:00Z', job: 'a', status: 'ok', owner: 'x' }),
      line({ at: '2026-01-01T00:45:00+01:00', job: 'a', status: 'retry', owner: 'x', error: 'early' }),
    ].join('\n');
    const [row] = parseNight('2026-01-01', text).rows;
    expect(row).toMatchObject({
      runs: 3,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'boom',
      firstAt: '2026-01-01T00:45:00+01:00',
      lastAt: '2026-01-01T01:30:00Z',
    });
  });
});
