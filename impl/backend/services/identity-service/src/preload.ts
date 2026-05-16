import dotenv from 'dotenv';
import path from 'node:path';

// Resolve impl/.env regardless of where the process is invoked from.
// Search upward from CWD until we find a `.env`, falling back to the
// monorepo-root location ../../../../ relative to this file.
function findEnv(): string {
  const candidate = path.resolve(__dirname, '../../../../.env');
  try {
    require('node:fs').accessSync(candidate);
    return candidate;
  } catch {
    return path.resolve(process.cwd(), '.env');
  }
}

dotenv.config({ path: findEnv() });
