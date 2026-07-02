// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Dev convenience: load `KEY=VALUE` pairs from the nearest `.env` (searching up
 * from `startDir`) into `process.env`, WITHOUT overriding variables already set
 * by the real environment. No-op when no `.env` exists — in production the
 * orchestrator (docker-compose `environment:`) supplies the real env.
 *
 * Call this before reading any `process.env` value at startup. The worker needs
 * it so TESSIO_SECRET_KEY is available to decrypt provider keys for triage.
 */
export function loadEnv(startDir: string = process.cwd()): void {
  try {
    let dir = startDir;
    for (;;) {
      const candidate = join(dir, '.env');
      if (existsSync(candidate)) {
        applyEnvFile(candidate);
        return;
      }
      const parent = dirname(dir);
      if (parent === dir) return; // reached the filesystem root
      dir = parent;
    }
  } catch {
    // Best-effort: never block startup on an env-file problem.
  }
}

function applyEnvFile(path: string): void {
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); // first '=' only — base64 values may end in '='
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // real env wins
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
