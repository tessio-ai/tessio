// SPDX-License-Identifier: AGPL-3.0-only

import { Icon } from '../icons';
import { useBot } from '../bot';
import type { PublicFormSummary } from '../../api/portal';
import type { PortalCatalogConfig, PortalCategory } from '@tessio/shared';
import type { CatalogGroup } from './grouping';

const OTHER_GROUP = { key: '__other__', label: 'Other requests', icon: 'inbox', color: '#6b7280' };

function CatalogCard({ form, color, onOpenForm }: { form: PublicFormSummary; color: string; onOpenForm: (key: string) => void }) {
  const bot = useBot();
  return (
    <button type="button" className="rp-card" onClick={() => onOpenForm(form.key)}>
      <span className="rc-ico" style={{ background: color }}><Icon name={form.icon || 'inbox'} size={19} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="rc-name">{form.name}</div>
        {form.description && <div className="rc-desc">{form.description}</div>}
        <div className="rc-meta">{form.theme.showTess ? <span className="ai-chip"><Icon name="sparkles" size={11} />{bot.name}-assisted</span> : <><Icon name="clock" size={12} />Usually answered within a day</>}</div>
      </div>
      <Icon name="chevronRight" size={18} className="rc-arrow" />
    </button>
  );
}

function RowCard({ form, color, onOpenForm }: { form: PublicFormSummary; color: string; onOpenForm: (key: string) => void }) {
  const bot = useBot();
  return (
    <button type="button" className="rp-row" onClick={() => onOpenForm(form.key)}>
      <span className="rc-ico" style={{ background: color }}><Icon name={form.icon || 'inbox'} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="rp-rn">{form.name}</div>
        {form.description && <div className="rp-rd">{form.description}</div>}
      </div>
      {form.theme.showTess && <span className="ai-chip"><Icon name="sparkles" size={11} />{bot.name}</span>}
      <Icon name="chevronRight" size={16} className="rc-arrow" />
    </button>
  );
}

function Group({ category, items, sectionStyle, cardStyle, onOpenForm }: { category: Pick<PortalCategory, 'label' | 'icon' | 'color'>; items: PublicFormSummary[]; sectionStyle: PortalCatalogConfig['sectionStyle']; cardStyle: PortalCatalogConfig['cardStyle']; onOpenForm: (key: string) => void }) {
  const band = sectionStyle === 'band';
  const headStyle = band ? { background: `color-mix(in oklab, ${category.color} 9%, #fff)`, borderColor: `color-mix(in oklab, ${category.color} 20%, transparent)` } : undefined;
  const Item = cardStyle === 'compact' ? RowCard : CatalogCard;
  return (
    <div className="rp-cat-group">
      <div className={`rp-cat-head${band ? ' band' : ''}`} style={headStyle}>
        <span className="ch-ico" style={{ background: category.color }}><Icon name={category.icon || 'inbox'} size={15} /></span>
        <span className="ch-name">{category.label}</span>
        <span className="ch-sub">· {items.length} request {items.length === 1 ? 'type' : 'types'}</span>
      </div>
      <div className="rp-cat-grid">
        {items.map((f) => <Item key={f.key} form={f} color={category.color} onOpenForm={onOpenForm} />)}
      </div>
    </div>
  );
}

export function PortalCatalogView({ catalog, groups, orphans, onOpenForm }: { catalog: PortalCatalogConfig; groups: CatalogGroup[]; orphans: PublicFormSummary[]; onOpenForm: (key: string) => void }) {
  const cols = catalog.columns === 'auto' ? 'auto-fill' : String(catalog.columns);
  return (
    <div className="rp-catalog" data-section-style={catalog.sectionStyle} data-card-style={catalog.cardStyle} style={{ ['--cols' as string]: cols }}>
      {groups.map(({ category, items }) => (
        <Group key={category.key} category={category} items={items} sectionStyle={catalog.sectionStyle} cardStyle={catalog.cardStyle} onOpenForm={onOpenForm} />
      ))}
      {orphans.length > 0 && (
        <Group category={OTHER_GROUP} items={orphans} sectionStyle={catalog.sectionStyle} cardStyle={catalog.cardStyle} onOpenForm={onOpenForm} />
      )}
    </div>
  );
}
