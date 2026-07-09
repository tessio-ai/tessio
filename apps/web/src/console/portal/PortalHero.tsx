// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type CSSProperties } from 'react';
import { Icon } from '../icons';
import { Orb } from '../agent';
import { useBot } from '../bot';
import { detectCategory } from '../portal-assist';
import { splitHeadline, resolvePills } from './hero-helpers';
import type { PortalSettingsRow, PublicFormSummary } from '../../api/portal';

export function PortalHero({ settings, forms, onOpenForm }: { settings: PortalSettingsRow; forms: PublicFormSummary[]; onOpenForm: (key: string) => void }) {
  const bot = useBot();
  const { hero } = settings;
  const [q, setQ] = useState('');
  const detected = q.length > 3 ? detectCategory(q) : null;
  const matches = q.length > 1 ? forms.filter((f) => `${f.name} ${f.description ?? ''} ${f.categoryKey}`.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : [];
  const pills = resolvePills(hero.pills, forms);
  const segs = splitHeadline(settings.heroHeadline);
  const style = { ['--pa']: settings.accent } as CSSProperties;

  return (
    <section className="rp-hero" data-preset={hero.preset} style={style}>
      <div className="rp-hero-inner">
        {hero.eyebrow && <span className="rp-eyebrow"><Icon name="sparkles" size={13} />{hero.eyebrow}</span>}
        <h1 className="rp-hi">{segs.map((s, i) => s.em ? <span key={i} className="hl-em">{s.text}</span> : <span key={i}>{s.text}</span>)}</h1>
        {settings.heroIntro && <p className="rp-hisub">{settings.heroIntro}</p>}
        {pills.length > 0 && (
          <div className="rp-hero-pills">
            {pills.map((p, i) => (
              <button type="button" key={i} className="rp-hpill" aria-disabled={!p.formKey} onClick={() => { if (p.formKey) onOpenForm(p.formKey); }}>{p.label}</button>
            ))}
          </div>
        )}
        {hero.showSearch && (
          <div className="rp-search">
            <Icon name="search" size={19} className="rs-ico" />
            <input aria-label="Search requests" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or describe your issue…" />
            {q.length > 1 && (
              <div className="rp-suggest">
                {detected && (<div className="rp-suggest-tess"><Orb size="sm" /><span><b>{bot.name}:</b> sounds like a {detected} issue — here's the fastest way to get help.</span></div>)}
                {matches.length ? matches.map((f) => (
                  <button type="button" className="rp-srow" key={f.key} onClick={() => onOpenForm(f.key)}>
                    <span className="ss-ico"><Icon name={f.icon ?? 'inbox'} size={15} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}><div className="ss-name">{f.name}</div><div className="ss-sub">{f.description}</div></div>
                    <Icon name="arrowRight" size={15} style={{ color: '#c4c7ce' }} />
                  </button>
                )) : <div className="rp-srow" style={{ color: '#7a8089', cursor: 'default' }}>No matching request.</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
