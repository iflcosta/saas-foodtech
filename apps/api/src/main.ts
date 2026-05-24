import { createClient } from '@saas-foodtech/db';
import { loadConfig } from './config.js';
import { build } from './server.js';

const config = loadConfig();
const db = createClient(config.DATABASE_URL);

const app = await build({
  db,
  jwtSecret: config.JWT_SECRET,
});

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
