// SPDX-License-Identifier: AGPL-3.0-only

import { Icon } from '../icons';
import type { ArticleSection } from './kb-types';
import { CALLOUT_ICON } from './kb-types';
import { sanitizeHtml } from './sanitize';

export function ProseBody({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="prose">
      {sections.map((sec) => (
        <section key={sec.id}>
          <h2 id={'sec-' + sec.id}>{sec.heading}</h2>
          {sec.blocks.map((b, i) => {
            if (b.t === 'p')
              return <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }} />;
            if (b.t === 'steps')
              return (
                <ol className="steps" key={i}>
                  {b.items.map((s, j) => (
                    <li key={j}>
                      <span className="step-n">{j + 1}</span>
                      <span className="step-tx" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s) }} />
                    </li>
                  ))}
                </ol>
              );
            if (b.t === 'list')
              return (
                <ul className="bullets" key={i}>
                  {b.items.map((s, j) => (
                    <li key={j}>
                      <span className="bullet-dot" />
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(s) }} />
                    </li>
                  ))}
                </ul>
              );
            if (b.t === 'note')
              return (
                <div key={i} className={'callout ' + b.kind}>
                  <span className="co-ico">
                    <Icon name={CALLOUT_ICON[b.kind]} size={16} />
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }} />
                </div>
              );
            return null;
          })}
        </section>
      ))}
    </div>
  );
}
