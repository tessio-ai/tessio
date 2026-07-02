import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Monaco's clipboard module calls document.queryCommandSupported at import time,
// but jsdom doesn't implement this API. Provide a no-op stub.
if (typeof document.queryCommandSupported === 'undefined') {
  Object.defineProperty(document, 'queryCommandSupported', {
    value: () => false,
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
