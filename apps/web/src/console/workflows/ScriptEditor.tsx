// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { setupMonaco, ctxLib } from './monaco-setup';

setupMonaco();

export function ScriptEditor({
  value,
  onChange,
  ticketFieldKeys,
}: {
  value: string;
  onChange: (v: string) => void;
  ticketFieldKeys: string[];
}) {
  const monacoRef = useRef<Monaco | null>(null);
  const ticketFieldKeysRef = useRef(ticketFieldKeys);
  ticketFieldKeysRef.current = ticketFieldKeys;

  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.dataset.theme === 'dark');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Re-apply the extra lib when ticketFieldKeys changes while mounted.
  useEffect(() => {
    const m = monacoRef.current;
    if (!m) return;
    const js = m.languages.typescript.javascriptDefaults;
    js.addExtraLib(ctxLib(ticketFieldKeys), 'ts:workflow-ctx.d.ts');
  }, [ticketFieldKeys]);

  const handleMount = (_editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    monacoRef.current = monaco;
    const js = monaco.languages.typescript.javascriptDefaults;
    js.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [1108, 1375, 1378],
    });
    js.addExtraLib(ctxLib(ticketFieldKeysRef.current), 'ts:workflow-ctx.d.ts');
  };

  return (
    <Editor
      height={300}
      language="javascript"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        fontSize: 13,
        tabSize: 2,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        padding: { top: 8, bottom: 8 },
        fixedOverflowWidgets: true,
      }}
      theme={isDark ? 'vs-dark' : 'vs'}
    />
  );
}
