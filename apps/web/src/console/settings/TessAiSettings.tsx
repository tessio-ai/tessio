// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useAiSettings, useUpdateAiSettings, useTestAiSettings } from './queries';
import type { AiFeatureFlags, UpdateAiSettingsInput } from '../../api/ai';

interface Draft {
  enabled: boolean;
  model: string;
  embeddingModel: string;
  apiKey: string; // blank means "leave existing key"
  botName: string;
  botIcon: string; // '' means "default orb"
  features: AiFeatureFlags;
}

const MODEL_HINT = 'e.g. gpt-4o-mini';
const EMBED_HINT = 'e.g. text-embedding-3-small';
const ICON_PRESETS = ['🤖', '✨', '🪄', '💡', '🦾', '🔮'];

export function TessAiSettings() {
  const { data } = useAiSettings();
  const update = useUpdateAiSettings();
  const test = useTestAiSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) {
      setDraft({
        enabled: data.enabled,
        model: data.model,
        embeddingModel: data.embeddingModel,
        apiKey: '',
        botName: data.botName,
        botIcon: data.botIcon ?? '',
        features: data.features,
      });
    }
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const setFeature = (k: keyof AiFeatureFlags, v: boolean) => setDraft({ ...draft, features: { ...draft.features, [k]: v } });

  const onSave = () => {
    const patch: UpdateAiSettingsInput = {
      enabled: draft.enabled,
      model: draft.model,
      embeddingModel: draft.embeddingModel,
      botIcon: draft.botIcon.trim() || null,
      features: draft.features,
    };
    if (draft.botName.trim()) patch.botName = draft.botName.trim();
    if (draft.apiKey.trim()) patch.apiKey = draft.apiKey.trim();
    setSaveResult(null);
    update.mutate(patch, {
      onSuccess: () => {
        setDraft((prev) => (prev ? { ...prev, apiKey: '' } : null));
        setSaveResult('Saved');
      },
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  const onTest = () => {
    setTestResult(null);
    test.mutate(undefined, {
      onSuccess: (r) => setTestResult(r.ok ? 'Connection OK' : `Failed: ${r.error ?? 'unknown error'}`),
      onError: (e) => setTestResult(`Failed: ${(e as Error).message}`),
    });
  };

  const displayName = draft.botName.trim() || 'Tess';

  return (
    <>
      <h1 className="set-h">{displayName} AI</h1>
      <p className="set-h-desc">Connect your OpenAI key so {displayName} can summarize, draft replies, triage, and find similar tickets. Your key is encrypted and never shown again.</p>

      <div className="set-card">
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Enable {displayName} AI</div><div className="sr-hint">Turn {displayName} AI on or off for this workspace.</div></div>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Assistant name</div><div className="sr-hint">What the assistant is called across the console, the requester portal, and its replies.</div></div>
            <input
              className="input"
              value={draft.botName}
              maxLength={24}
              placeholder="Tess"
              onChange={(e) => set('botName', e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Assistant icon</div><div className="sr-hint">An emoji or 1–2 letters shown inside the orb — leave blank for the plain orb.</div></div>
            <div className="logo-controls">
              <span className="orb lg" aria-hidden="true">
                {draft.botIcon.trim() && <span className="orb-ic">{draft.botIcon.trim()}</span>}
              </span>
              <div>
                <input
                  className="input mono-input"
                  value={draft.botIcon}
                  maxLength={4}
                  placeholder="🤖"
                  onChange={(e) => set('botIcon', e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  {ICON_PRESETS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      title={`Use ${ic}`}
                      onClick={() => set('botIcon', ic)}
                      style={{ all: 'unset', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                    >
                      {ic}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => set('botIcon', '')}
                    style={{ fontSize: 'var(--t-caption)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="set-row">
            <div><div className="sr-label">Chat model</div><div className="sr-hint">{MODEL_HINT}</div></div>
            <input className="input" value={draft.model} placeholder={MODEL_HINT} onChange={(e) => set('model', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Embedding model</div><div className="sr-hint">Used for similar-tickets ({EMBED_HINT})</div></div>
            <input className="input" value={draft.embeddingModel} placeholder={EMBED_HINT} onChange={(e) => set('embeddingModel', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">API key</div><div className="sr-hint">Stored encrypted — leave blank to keep the current key.</div></div>
            <input
              className="input"
              type="password"
              value={draft.apiKey}
              placeholder={data.apiKeySet ? `•••• ${data.apiKeyHint ?? ''} (leave blank to keep)` : 'Paste your OpenAI key'}
              onChange={(e) => set('apiKey', e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Features</div><div className="sr-hint">Which {displayName} AI capabilities to enable.</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['summary', 'draft', 'triage', 'similar', 'ask'] as const).map((f) => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--t-small)' }}>
                  <input
                    type="checkbox"
                    checked={draft.features[f]}
                    onChange={(e) => setFeature(f, e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{f}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="set-card-foot">
          <Button variant="outline" onClick={onTest} disabled={test.isPending || !data.model} title={!data.model ? 'Save a model first' : undefined}>
            {test.isPending ? 'Testing…' : 'Test connection'}
          </Button>
          {testResult && <span className="sf-note">{testResult}</span>}
          <div style={{ flex: 1 }} />
          {saveResult && <span className="sf-note">{saveResult}</span>}
          <Button variant="primary" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
