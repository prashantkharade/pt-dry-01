import dotenv from 'dotenv';
import path from 'node:path';

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
