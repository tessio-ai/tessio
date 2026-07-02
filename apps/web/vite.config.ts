import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Open-core build switch: only enterprise/cloud builds bundle the commercial
// @tessio/ee-web package. Community aliases it to a no-op stub so the enterprise
// UI is never shipped. The enterprise screens are also hidden at runtime by the
// entitlement gate in Settings.tsx. See LICENSING.md.
const EDITION = process.env.TESSIO_EDITION ?? 'community';
const IS_ENTERPRISE = EDITION === 'enterprise' || EDITION === 'cloud';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: IS_ENTERPRISE
      ? {}
      : {
          '@tessio/ee-web': fileURLToPath(new URL('./src/console/settings/ee-web-stub.tsx', import.meta.url)),
        },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
