// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Blob storage for attachments. `key` is opaque (`<orgId>/<attachmentId>`, uuid-based). */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Local-disk storage rooted at `rootDir`. The community/self-hosted default. */
export function diskStorage(rootDir: string): Storage {
  const full = (key: string) => join(rootDir, key);
  return {
    async put(key, data) {
      const p = full(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    async get(key) {
      return readFile(full(key));
    },
    async delete(key) {
      await rm(full(key), { force: true });
    },
  };
}
