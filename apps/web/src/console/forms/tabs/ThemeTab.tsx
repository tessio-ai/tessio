// SPDX-License-Identifier: AGPL-3.0-only

import type { PortalTheme } from '@tessio/shared';
import { useBot } from '../../bot';

export function ThemeTab({ theme, onChange }: { theme: PortalTheme; onChange: (t: PortalTheme) => void }) {
  const bot = useBot();
  const set = (patch: Partial<PortalTheme>) => onChange({ ...theme, ...patch });
  return (
    <div className="theme-tab">
      <div className="field"><label className="field-label" htmlFor="t_headline">Headline</label>
        <input id="t_headline" className="input" value={theme.headline} onChange={(e) => set({ headline: e.target.value })} /></div>
      <div className="field"><label className="field-label" htmlFor="t_intro">Intro</label>
        <textarea id="t_intro" className="textarea" value={theme.intro ?? ''} onChange={(e) => set({ intro: e.target.value })} /></div>
      <div className="field"><label className="field-label" htmlFor="t_success">Success message</label>
        <input id="t_success" className="input" value={theme.success ?? ''} onChange={(e) => set({ success: e.target.value })} /></div>
      <div className="field"><label className="field-label" htmlFor="t_accent">Accent</label>
        <input id="t_accent" type="color" value={theme.accent} onChange={(e) => set({ accent: e.target.value })} /></div>
      <div className="field"><label className="field-label" htmlFor="t_layout">Layout</label>
        <select id="t_layout" className="select" value={theme.layout} onChange={(e) => set({ layout: e.target.value as PortalTheme['layout'] })}>
          <option value="single">single</option><option value="card">card</option></select></div>
      <label className="field-check"><input type="checkbox" checked={theme.showTess} onChange={(e) => set({ showTess: e.target.checked })} /> Show {bot.name} assist</label>
    </div>
  );
}
