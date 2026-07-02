// SPDX-License-Identifier: AGPL-3.0-only

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import { TICKET_COLUMNS } from './variables';
// Vite bundles these as web workers (no CDN fetch).
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let configured = false;
export function setupMonaco(): void {
  if (configured) return;
  configured = true;
  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker: (_id, label) => (label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker()),
  };
  loader.config({ monaco });
}

/** Build a .d.ts describing the script `ctx`, including custom ticket fields under ctx.ticket.data. */
export function ctxLib(ticketFieldKeys: string[]): string {
  const dataFields = ticketFieldKeys.map((k) => `      ${JSON.stringify(k)}: any;`).join('\n');
  // Explicit columns (so every ticket field autocompletes), shared with the {{ }} catalog.
  const cols = TICKET_COLUMNS.map((c) => `    ${c}: any;`).join('\n');
  return `declare const ctx: {
  trigger: any;
  ticket: {
${cols}
    data: {
${dataFields}
      [key: string]: any;
    };
    [key: string]: any;
  };
  nodes: Record<string, { output: any }>;
  run: { id: string };
};`;
}
