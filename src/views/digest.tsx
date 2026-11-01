import type { DigestRow, Night } from '../digest/types.js';

// Retries at or above this are marked.
export const RETRY_MARK = 3;

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);

function DigestTableRow({ row }: { row: DigestRow }) {
  const failed = row.lastStatus === 'fail';
  const retried = row.retries >= RETRY_MARK;
  return (
    <tr data-job={row.job}>
      <td>{row.job}</td>
      <td>{dash(row.owner)}</td>
      <td class={failed ? 'warn' : undefined}>{failed ? '✗ fail' : row.lastStatus}</td>
      <td class={retried ? 'warn' : undefined}>{retried ? `⚠ ${row.retries}` : String(row.retries)}</td>
      <td>{row.runs}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
      <td>{dash(row.lastError)}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>status</th>
              <th>retries</th>
              <th>runs</th>
              <th>first</th>
              <th>last</th>
              <th>last error</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <DigestTableRow row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && <p class="mute">{night.badLines} unreadable line(s) skipped</p>}
    </>
  );
}

export function NoSuchNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
