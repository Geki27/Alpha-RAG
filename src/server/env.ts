import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load local overrides first (.env.local), then standard .env without overwriting OS/container env vars
const rootDir = process.cwd();
const envFiles = ['.env.local', '.env'];

for (const fileName of envFiles) {
  const fullPath = path.join(rootDir, fileName);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: false });
  }
}

const port = Number(process.env.APP_PORT) || 3000;
if (!process.env.APP_URL) {
  process.env.APP_URL = `http://localhost:${port}`;
}
