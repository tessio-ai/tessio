// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent, RefObject } from 'react';
import type { VariableEntry } from './variables';
import { activeTemplateQuery, applyCompletion, filterVariables } from './template-complete';

export interface TemplateFieldProps {
  value: string;
  onChange: (v: string) => void;
  variables: VariableEntry[];
  placeholder?: string;
  className?: string;
  rows?: number;
  style?: React.CSSProperties;
}

interface ActiveQuery {
  start: number;
  query: string;
}

interface SuggestState {
  active: ActiveQuery | null;
  items: VariableEntry[];
  highlight: number;
  // Portal rect — set when items become non-empty, cleared when closed.
  rect: DOMRect | null;
}

const CLOSED: SuggestState = { active: null, items: [], highlight: 0, rect: null };

// ---------------------------------------------------------------------------
// SuggestList — rendered via a portal so .wf-panel's overflow-y:auto doesn't
// clip the dropdown. Position is fixed using the input/textarea's bounding rect.
// ---------------------------------------------------------------------------
interface SuggestListProps {
  items: VariableEntry[];
  highlight: number;
  rect: DOMRect;
  onAccept: (entry: VariableEntry) => void;
}

function SuggestList({ items, highlight, rect, onAccept }: SuggestListProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 2,
    left: rect.left,
    width: rect.width,
    zIndex: 9999,
    // Override the absolute/top:100% defaults in .wf-suggest
    margin: 0,
  };

  return createPortal(
    <ul className="wf-suggest" style={style}>
      {items.map((entry, i) => (
        <li
          key={entry.path}
          className={i === highlight ? 'active' : undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            onAccept(entry);
          }}
        >
          {entry.path}
          {entry.detail && <span className="muted"> — {entry.detail}</span>}
        </li>
      ))}
    </ul>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
function useTemplateComplete(
  value: string,
  onChange: (v: string) => void,
  variables: VariableEntry[],
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  const [state, setState] = useState<SuggestState>(CLOSED);

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const aq = activeTemplateQuery(value, caret);
    if (!aq) {
      setState(CLOSED);
      return;
    }
    const items = filterVariables(variables, aq.query);
    if (items.length === 0) {
      setState(CLOSED);
      return;
    }
    const rect = el.getBoundingClientRect();
    setState({ active: aq, items, highlight: 0, rect });
  }, [ref, value, variables]);

  // Fix #2: run recompute after each value change so paste/programmatic updates
  // see the correct (post-update) value in the closure — not a stale snapshot.
  // We keep onKeyUp / onClick / onSelect on the elements for caret-move cases
  // (arrow keys, mouse clicks repositioning caret) that don't change value.
  useEffect(() => {
    recompute();
    // recompute's identity already encodes value + variables + ref changes,
    // so depending on recompute is correct and avoids a stale-closure trap.
  }, [recompute]);

  // Fix #3: close the dropdown on window scroll/resize while open so it never
  // detaches from the field (it's now fixed-positioned to the viewport).
  useEffect(() => {
    if (!state.items.length) return;
    const close = () => setState(CLOSED);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close, { passive: true });
    return () => {
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [state.items.length]);

  const accept = useCallback(
    (entry: VariableEntry) => {
      const el = ref.current;
      if (!el || !state.active) return;
      const caret = el.selectionStart ?? 0;
      const result = applyCompletion(value, caret, state.active, entry.path);
      onChange(result.value);
      setState(CLOSED);
      requestAnimationFrame(() => {
        el.setSelectionRange(result.caret, result.caret);
      });
    },
    [ref, value, onChange, state.active],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (state.items.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setState((s) => ({ ...s, highlight: (s.highlight + 1) % s.items.length }));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setState((s) => ({ ...s, highlight: (s.highlight - 1 + s.items.length) % s.items.length }));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          accept(state.items[state.highlight]);
          return;
        }
        if (e.key === 'Escape') {
          setState(CLOSED);
          return;
        }
      } else if (e.key === 'Tab' && (e.currentTarget as HTMLElement).tagName === 'TEXTAREA') {
        // Tab inserts two spaces in textareas when the dropdown is closed.
        e.preventDefault();
        const el = e.currentTarget as HTMLTextAreaElement;
        const { selectionStart, selectionEnd, value: v } = el;
        const next = v.slice(0, selectionStart) + '  ' + v.slice(selectionEnd);
        onChange(next);
        requestAnimationFrame(() => el.setSelectionRange(selectionStart + 2, selectionStart + 2));
      }
    },
    [state, accept, onChange],
  );

  // Fix #1: blur handler — delay by one rAF so onMouseDown on a suggestion item
  // fires (and calls accept) before we close the dropdown.
  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => setState(CLOSED));
  }, []);

  return { state, recompute, accept, handleKeyDown, handleBlur };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function TemplateInput({ value, onChange, variables, placeholder, className, style }: TemplateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const { state, recompute, accept, handleKeyDown, handleBlur } = useTemplateComplete(
    value,
    onChange,
    variables,
    ref as RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  );

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        style={style}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={recompute}
        onClick={recompute}
        onSelect={recompute}
        onBlur={handleBlur}
      />
      {state.items.length > 0 && state.rect && (
        <SuggestList items={state.items} highlight={state.highlight} rect={state.rect} onAccept={accept} />
      )}
    </div>
  );
}

export function TemplateTextarea({ value, onChange, variables, placeholder, className, rows, style }: TemplateFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { state, recompute, accept, handleKeyDown, handleBlur } = useTemplateComplete(
    value,
    onChange,
    variables,
    ref as RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  );

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        className={className}
        rows={rows}
        style={style}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={recompute}
        onClick={recompute}
        onSelect={recompute}
        onBlur={handleBlur}
      />
      {state.items.length > 0 && state.rect && (
        <SuggestList items={state.items} highlight={state.highlight} rect={state.rect} onAccept={accept} />
      )}
    </div>
  );
}
