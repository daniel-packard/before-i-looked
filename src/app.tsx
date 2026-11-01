import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage, NoSuchNight } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = readNight(config.runsDir, name);
    if (!night) {
      return c.html(
        <Layout title={`digest ${name}`} lane={lane()}>
          <NoSuchNight night={name} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${name}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  // Same rows as the digest page (readNight, sorted by job), as JSON for agents.
  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night) return c.json({ error: 'no such night' }, 404);
    return c.json(night);
  });

  return app;
}
