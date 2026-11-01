import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
const real = createApp({ ...base, runsDir: 'runs' });

describe('GET /digest/:night', () => {
  it('renders the real night as one table, sorted by job, with marks', async () => {
    const res = await real.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)).toHaveLength(1);
    const jobs = [...html.matchAll(/data-job="([^"]+)"/g)].map((m) => m[1]!);
    expect(jobs).toEqual([...jobs].sort());
    expect(html).toContain('✗ fail');
    expect(html).toContain('⚠');
  });

  it('404s a night with no file or a non-date', async () => {
    expect((await real.request('/digest/2030-01-01')).status).toBe(404);
    expect((await real.request('/digest/..%2Fsecret')).status).toBe(404);
  });

  describe('synthetic nights', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    const app = createApp({ ...base, runsDir: dir });

    it('an empty file renders "nothing ran"', async () => {
      writeFileSync(join(dir, '2026-01-01.jsonl'), '');
      const res = await app.request('/digest/2026-01-01');
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('nothing ran');
    });

    it('marks 3 retries but not 2, and shows a missing owner as a dash', async () => {
      const line = (job: string, status: string) =>
        JSON.stringify({ at: '2026-01-02T01:00:00+01:00', job, status, owner: null });
      writeFileSync(
        join(dir, '2026-01-02.jsonl'),
        [line('a', 'retry'), line('a', 'retry'), line('a', 'retry'), line('a', 'ok'), line('b', 'retry'), line('b', 'retry'), line('b', 'ok')].join('\n'),
      );
      const html = await (await app.request('/digest/2026-01-02')).text();
      expect(html).toContain('⚠ 3');
      expect(html).not.toContain('⚠ 2');
      expect(html).toContain('<td>—</td>');
    });
  });
});
