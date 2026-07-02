// SPDX-License-Identifier: AGPL-3.0-only

/* Create / edit ticket — drawer hosting schema-driven form. Ported from the design handoff. */
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Button, IconButton, Kbd, EmptyState } from './ui';
import { TYPE_MAP } from './data';
import { useTicketSchemas, useCreateTicket } from './tickets/queries';
import { ticketTypeKeyById } from './tickets/types-map';
import type { FieldDef } from '@tessio/shared';
import type { Route } from './shell';

function FormField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const id = 'f_' + field.key;
  const isFullWidth = field.width === 'full';
  return (
    <div className={'field' + (isFullWidth ? ' col-span-2' : '')}>
      <label className="field-label" htmlFor={id}>
        {field.label}
        {field.required && <span className="req">*</span>}
      </label>
      {field.type === 'long-text' || field.type === 'rich-text' ? (
        <textarea id={id} className="textarea" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'select' || field.type === 'multiselect' ? (
        <select id={id} className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Select…
          </option>
          {((field.config?.options as string[] | undefined) ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input id={id} className="input" type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function CreateDrawer({ onClose, go }: { onClose: () => void; go: (s: string, e?: { ticketId?: string }) => void }) {
  const { data: schemas } = useTicketSchemas();
  const [schemaId, setSchemaId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    if (!schemaId && schemas?.length) setSchemaId(schemas[0].id);
  }, [schemas, schemaId]);

  const schema = schemas?.find((s) => s.id === schemaId);
  const typeKeyMap = ticketTypeKeyById(schemas ?? []);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const create = useCreateTicket();

  const submit = () => {
    if (!schema) return;
    create.mutate(
      {
        schemaId: schema.id,
        schemaVersion: schema.version,
        status: 'open',
        priority,
        data: values,
      },
      {
        onSuccess: (row) => {
          go('tickets', { ticketId: row.id });
          onClose();
        },
      },
    );
  };

  // Sort fields by order if present
  const fields = schema
    ? [...schema.definition.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  // Disable create when any required field is empty
  const hasAllRequired = fields.filter((f) => f.required).every((f) => !!values[f.key]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="drawer"
        role="dialog"
        aria-label="New ticket"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className="drawer-head">
          <div className="drawer-title">New ticket</div>
          <IconButton name="x" title="Close" onClick={onClose} />
        </div>
        <div className="drawer-body">
          <div className="field">
            <label className="field-label">Type</label>
            <div className="type-picker">
              {(schemas ?? []).map((s) => {
                const tk = typeKeyMap[s.id] ?? 'request';
                const icon = TYPE_MAP[tk]?.icon ?? 'ticket';
                return (
                  <div
                    key={s.id}
                    className={'type-opt' + (schemaId === s.id ? ' active' : '')}
                    onClick={() => setSchemaId(s.id)}
                  >
                    <span className="ti">
                      <Icon name={icon} size={16} />
                    </span>
                    <div>
                      <div className="tn">{s.name}</div>
                      <div className="td">{s.key}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="tk_priority">Priority</label>
            <select id="tk_priority" aria-label="Priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {schema && (
            <div className="form-section">
              <div className="form-section-title">
                <Icon name="form" size={14} style={{ color: 'var(--muted-foreground)' }} />
                {schema.name}
              </div>
              <div className="form-grid">
                {fields.map((f) => (
                  <FormField key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--muted-foreground)',
              fontSize: 'var(--t-caption)',
              marginTop: 4,
            }}
          >
            <Icon name="zap" size={13} />
            Fields are generated from this ticket type's schema definition.
          </div>
        </div>
        <div className="drawer-foot">
          <span
            style={{
              flex: 1,
              fontSize: 'var(--t-caption)',
              color: 'var(--faint-foreground)',
              display: 'inline-flex',
              gap: 5,
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> to create
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!hasAllRequired}>
            Create ticket
          </Button>
        </div>
      </div>
    </>
  );
}

const PLACEHOLDER: Record<string, { icon: string; title: string; desc: string }> = {
  assets: { icon: 'box', title: 'Assets (CMDB)', desc: 'Asset tag, type, status, owner, location — same list + detail pattern as Tickets, plus a relationships graph.' },
  knowledge: { icon: 'book', title: 'Knowledge Base', desc: 'Articles with a typographic reading view, table of contents, and an edit mode.' },
  workflows: { icon: 'workflow', title: 'Workflows', desc: 'A node-graph automation builder. Out of scope for this first UI pass — nav placeholder only.' },
  reports: { icon: 'chart', title: 'Reports', desc: 'Team-level dashboards: load by assignee, SLA compliance, and trends.' },
  settings: { icon: 'settings', title: 'Settings', desc: 'Configure ticket types and schemas, teams, members, and workflows.' },
};

export function Placeholder({ screen, go }: { screen: string; go: (s: string, e?: Partial<Route>) => void }) {
  const p = PLACEHOLDER[screen] || { icon: 'inbox', title: 'Coming soon', desc: '' };
  return (
    <div className="page">
      <div className="page-header"><h1 className="ph-title">{p.title}</h1></div>
      <div className="page-pad">
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <EmptyState
            icon={p.icon}
            title={p.title}
            body={p.desc}
            action={
              <>
                <Button variant="outline" size="sm" onClick={() => go('tickets')} icon="ticket">Go to Tickets</Button>
                <Button variant="primary" size="sm" icon="arrowRight" iconRight="arrowRight">Build this next</Button>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
