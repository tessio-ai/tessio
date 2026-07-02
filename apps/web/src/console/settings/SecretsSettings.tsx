// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button } from '../ui';
import { useSecrets, useCreateSecret, useReplaceSecret, useDeleteSecret } from './queries';

const NAME_RE = /^[a-z0-9_]+$/;

export function SecretsSettings() {
  const { data: secrets = [] } = useSecrets();
  const create = useCreateSecret();
  const replace = useReplaceSecret();
  const remove = useDeleteSecret();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const nameOk = NAME_RE.test(name);
  const canAdd = nameOk && value.length >= 4 && !create.isPending;

  const onAdd = () => {
    setCreateError(null);
    create.mutate(
      { name, value },
      {
        onSuccess: () => {
          setName('');
          setValue('');
        },
        onError: (e) => setCreateError((e as Error).message),
      },
    );
  };

  return (
    <>
      <h1 className="set-h">Secrets</h1>
      <p className="set-h-desc">
        Encrypted credentials for workflows. Reference them in any template field as{' '}
        <code>{'{{ secrets.name }}'}</code>. Values are write-only and never shown again after saving.
      </p>

      <div className="set-card">
        <div className="set-card-body">
          {secrets.length === 0 ? (
            <div className="set-row">
              <span style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No secrets yet.</span>
            </div>
          ) : (
            secrets.map((s) => (
              <div className="set-row" key={s.name} style={{ alignItems: 'center' }}>
                <div>
                  <div className="sr-label"><code>{s.name}</code></div>
                  <div className="sr-hint">Last 4 characters: …{s.hint}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = window.prompt(`New value for "${s.name}"`);
                      if (v === null || v === '') return;
                      if (v.length < 4) {
                        setReplaceError('Value must be at least 4 characters.');
                        return;
                      }
                      setReplaceError(null);
                      replace.mutate(
                        { name: s.name, value: v },
                        {
                          onSuccess: () => setReplaceError(null),
                          onError: (e) => setReplaceError((e as Error).message),
                        },
                      );
                    }}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="trash"
                    onClick={() => remove.mutate(s.name)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
          {replaceError && (
            <span className="sf-note" style={{ color: 'var(--danger)', padding: '0 16px 10px' }}>{replaceError}</span>
          )}
        </div>
        <div className="set-card-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              placeholder="name (a-z, 0-9, _)"
              value={name}
              onChange={(e) => { setName(e.target.value); setCreateError(null); }}
              style={{ maxWidth: 200 }}
            />
            <input
              className="input"
              type="password"
              placeholder="value (min 4 chars)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <Button variant="primary" size="sm" disabled={!canAdd} onClick={onAdd}>
              {create.isPending ? 'Adding…' : 'Add secret'}
            </Button>
          </div>
          {name !== '' && !nameOk && (
            <span className="sf-note" style={{ color: 'var(--danger)' }}>
              Use lowercase letters, digits, and underscores only.
            </span>
          )}
          {value.length > 0 && value.length < 4 && (
            <span className="sf-note" style={{ color: 'var(--danger)' }}>
              Value must be at least 4 characters.
            </span>
          )}
          {createError && <span className="sf-note" style={{ color: 'var(--danger)' }}>{createError}</span>}
        </div>
      </div>
    </>
  );
}
