import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the night as readNight reads it, jobs in order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[] };
    expect(body).toEqual(readNight('runs', '2026-10-28'));
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('is 404 JSON for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('is 404 for a night that is not a date', async () => {
    const res = await createApp(config).request('/api/digest/nope');
    expect(res.status).toBe(404);
  });

  describe('synthetic nights', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    const app = createApp({ ...config, runsDir: dir });

    it('an empty night is 200 with no rows', async () => {
      writeFileSync(join(dir, '2026-01-01.jsonl'), '');
      const res = await app.request('/api/digest/2026-01-01');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(await res.json()).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
    });

    it('a bad line is counted in badLines and the good lines still come back', async () => {
      const good = JSON.stringify({ at: '2026-01-02T01:00:00+01:00', job: 'a', status: 'ok', owner: null });
      writeFileSync(join(dir, '2026-01-02.jsonl'), `${good}\nnot json\n`);
      const res = await app.request('/api/digest/2026-01-02');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rows: { job: string; owner: string | null }[]; badLines: number };
      expect(body.badLines).toBe(1);
      expect(body.rows.map((r) => [r.job, r.owner])).toEqual([['a', null]]);
    });
  });
});
