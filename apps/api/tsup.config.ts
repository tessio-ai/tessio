import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  platform: 'node',
  // Bundle workspace packages into the output so the container image does not
  // need to resolve @tessio/* .ts source files from node_modules at runtime.
  // All other dependencies remain external (resolved from node_modules at runtime).
  noExternal: [/@tessio\//],
  // Inject a CommonJS compatibility shim so that CJS packages bundled
  // transitively (e.g. pg) can still call require() for Node built-ins.
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`.trim(),
  },
});
