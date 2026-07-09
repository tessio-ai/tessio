// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from 'react';
import './landing.css';

/* ── Bento / tile icons (inline SVGs, white via .tile-ico) ── */

function SearchIcon() {
  return (
    <svg className="tile-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="tile-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="tile-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="tile-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="tile-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ── Step icons (stroke white on colored bubble) ── */

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

/* ── Compare icons ── */

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ── Content ── */

const DOCS_URL = 'https://tessio-ai.github.io/tessio/';
const GITHUB_URL = 'https://github.com/tessio-ai/tessio';
const START_URL = `${DOCS_URL}getting-started/`;

/* Deep links into the self-hosting manual (mkdocs slugs) */
const TOUR_URL = `${DOCS_URL}#see-tessio-in-action`;
const KNOWLEDGE_URL = `${DOCS_URL}#knowledge-base`;
const DASHBOARDS_URL = `${DOCS_URL}#agent-dashboard`;
const CONFIG_URL = `${DOCS_URL}configuration/`;
const COMPOSE_URL = `${DOCS_URL}install/compose/`;
const K8S_URL = `${DOCS_URL}install/kubernetes/`;

const COMPARE_OLD = [
  'Dated, cluttered interfaces agents dread',
  'Manual triage and routing, every ticket',
  'AI bolted on as an afterthought, if at all',
  'Weeks of setup and consultants to configure',
  'Mouse-driven, slow, page-reload heavy',
];

const COMPARE_NEW = [
  'A calm, fast workspace in the spirit of Linear',
  'Tess triages, routes, and resolves autonomously',
  'An AI teammate woven through every surface',
  'Schema-driven — live in a day, no consultants',
  'Keyboard-first, optimistic, desktop-fast',
];

/* ── Main component ── */

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll('.landing-reveal').forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          // count-up any dashboard numerals revealed in this block
          e.target.querySelectorAll<HTMLElement>('.d2-n[data-to]').forEach((el) => {
            const to = parseInt(el.getAttribute('data-to') ?? '0', 10);
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / 1100);
              el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          io.unobserve(e.target);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' },
    );
    root.querySelectorAll('.landing-reveal:not(.in)').forEach((el) => io.observe(el));

    // hero aurora follows the pointer
    const hero = root.querySelector<HTMLElement>('.landing-hero');
    const onMove = (ev: PointerEvent) => {
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${((ev.clientX - r.left) / r.width) * 100}%`);
      hero.style.setProperty('--my', `${((ev.clientY - r.top) / r.height) * 100}%`);
    };
    hero?.addEventListener('pointermove', onMove);

    return () => {
      io.disconnect();
      hero?.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="landing" ref={rootRef}>
      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-nav-pill">
          <a className="landing-brand" href="#top">
            <span className="mark" />Tessio
          </a>
          <div className="landing-nav-links">
            <a href="#how">Platform</a>
            <a href="#features">Product</a>
            <a href="#compare">Why Tessio</a>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
          </div>
          <div className="landing-nav-right">
            <a className="landing-nav-login" href={GITHUB_URL} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
            <a className="btn btn-dark" href={START_URL} target="_blank" rel="noreferrer">Get started</a>
          </div>
        </div>
      </nav>

      <span id="top" />

      {/* HERO */}
      <header className="landing-hero">
        <div className="wrap">
          <div className="landing-eyebrow landing-reveal in">
            <span className="eb-orb" /> ITSM with an AI teammate built in
          </div>
          <h1 className="disp landing-reveal in">
            Run your service desk<br />on <span className="ink-pop">autopilot</span>
          </h1>
          <p className="sub landing-reveal in d1">
            Tess triages every ticket, routes it to the right team, drafts the reply, and resolves the routine
            — so your agents handle only what actually needs a human.
          </p>
          <div className="landing-hero-cta landing-reveal in d2">
            <a className="btn btn-dark btn-lg" href={START_URL} target="_blank" rel="noreferrer">Get started — free</a>
            <a className="btn btn-line btn-lg" href={GITHUB_URL} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
          <div className="landing-hero-micro landing-reveal in d3">
            Free to self-host · Elastic License 2.0 · Live in ~5 minutes
          </div>

          {/* BENTO GRID */}
          <div className="landing-bento landing-reveal d1">
            <div className="row r1">
              <div className="tile avatar"><span className="ava">DK</span></div>
              <div className="tile t-pinkhot tcap"><SearchIcon /><span className="tile-cap">⌘K Search</span></div>
              <div className="tile t-violet tcap"><MailIcon /><span className="tile-cap">Email&nbsp;in</span></div>
              <div className="tile ask">Ask Tess anything…<span className="qmark" /></div>
              <div className="tile orbtile"><span className="landing-orb o1" /></div>
              <div className="tile wide-stat"><b>TESS</b><span>your always-on triage agent</span></div>
            </div>
            <div className="row r2">
              <div className="tile t-coral stat"><span className="tile-num">94%</span><span className="tile-lab">SLA met</span></div>
              <div className="tile pillrow">
                <span className="mini-pill mp-open"><i className="mp-dot" />Open · #142</span>
                <span className="mini-pill mp-ai"><i className="mp-orb" />Assign Priya</span>
              </div>
              <div className="tile t-cyan tcap"><BookIcon /><span className="tile-cap">Docs</span></div>
              <div className="tile t-peach stat hide-sm"><span className="tile-num">128</span><span className="tile-lab">Open</span></div>
              <div className="tile t-pinkhot tcap"><BoltIcon /><span className="tile-cap">Rules</span></div>
              <div className="tile t-lime tcap"><CheckIcon /><span className="tile-cap">Solved</span></div>
              <div className="tile t-sand stat hide-sm"><span className="tile-num">62%</span><span className="tile-lab">Deflected</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* PRODUCT SHOWCASE */}
      <section className="landing-showcase">
        <div className="wrap">
          <div className="appwin landing-reveal" aria-hidden="true">
            <div className="aw-bar">
              <span className="aw-dots"><i /><i /><i /></span>
              <span className="aw-url">app.tessio.com/tickets</span>
            </div>
            <div className="aw-body">
              <aside className="aw-rail">
                <span className="aw-mark" />
                <span className="aw-nav on" />
                <span className="aw-nav" />
                <span className="aw-nav" />
                <span className="aw-nav" />
                <span className="aw-foot" />
              </aside>
              <main className="aw-main">
                <div className="aw-head">
                  <div className="aw-title">Tickets</div>
                  <div className="aw-tabs">
                    <span className="aw-tab on">All <i>128</i></span>
                    <span className="aw-tab">Unassigned <i>17</i></span>
                    <span className="aw-tab">Urgent <i>4</i></span>
                  </div>
                  <span className="aw-new">+ New</span>
                </div>
                <div className="aw-rows">
                  <div className="aw-row sel"><span className="aw-ck on" /><span className="aw-d urgent" /><span className="aw-id">#142</span><span className="aw-sub">VPN access broken</span><span className="aw-pill open">Open</span><span className="aw-ava a1">PR</span></div>
                  <div className="aw-row sel"><span className="aw-ck on" /><span className="aw-d high" /><span className="aw-id">#138</span><span className="aw-sub">Laptop won't boot</span><span className="aw-pill prog">In progress</span><span className="aw-ava a2">JM</span></div>
                  <div className="aw-row"><span className="aw-ck" /><span className="aw-d norm" /><span className="aw-id">#131</span><span className="aw-sub">Onboard new hire — Marketing</span><span className="aw-pill wait">Waiting</span><span className="aw-ava a3">AK</span></div>
                  <div className="aw-row"><span className="aw-ck" /><span className="aw-d norm" /><span className="aw-id">#129</span><span className="aw-sub">Reset MFA device</span><span className="aw-pill done">Resolved</span><span className="aw-ava a4">TS</span></div>
                  <div className="aw-row"><span className="aw-ck" /><span className="aw-d high" /><span className="aw-id">#127</span><span className="aw-sub">Printer offline — 3rd floor</span><span className="aw-pill open">Open</span><span className="aw-ava a1">PR</span></div>
                </div>
              </main>
              <aside className="aw-assist">
                <div className="aw-assist-top"><span className="landing-orb o2" /><b>Tess</b></div>
                <div className="aw-assist-card">
                  <div className="aw-ac-label">Suggested triage · #142</div>
                  <div className="aw-ac-line"><span className="aw-k">Category</span><span className="aw-chip">VPN access</span></div>
                  <div className="aw-ac-line"><span className="aw-k">Priority</span><span className="aw-chip red">Urgent</span></div>
                  <div className="aw-ac-line"><span className="aw-k">Route</span><span className="aw-chip">IT · Network</span></div>
                  <div className="aw-ac-cta">Apply &amp; reply</div>
                </div>
                <div className="aw-assist-meter"><span className="aw-meter-k">Confidence</span><span className="aw-meter"><i /></span></div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="landing-sec landing-light" id="how">
        <div className="wrap">
          <div className="landing-reveal">
            <div className="landing-kicker">How Tess works</div>
            <h2 className="landing-sec-h">Inbox to resolved,<br />before you look.</h2>
            <p className="landing-sec-lead">
              Every request that lands is read, understood, and acted on automatically.
              What's left reaches an agent already triaged.
            </p>
          </div>
          <div className="landing-steps">
            <div className="landing-step s1 landing-reveal">
              <div className="si"><SparkleIcon /></div>
              <div className="n">01</div>
              <h3>Understands</h3>
              <p>Reads each ticket, classifies category and priority, and links the affected asset — no forms to wrangle.</p>
            </div>
            <div className="landing-step s2 landing-reveal d1">
              <div className="si"><RouteIcon /></div>
              <div className="n">02</div>
              <h3>Acts</h3>
              <p>Routes to the right team, drafts a reply, deflects to a help article, or resolves it outright when confident.</p>
            </div>
            <div className="landing-step s3 landing-reveal d2">
              <div className="si"><DoubleCheckIcon /></div>
              <div className="n">03</div>
              <h3>Hands off</h3>
              <p>What's left lands with a summary, a suggested resolution, and similar past tickets already attached.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — alternating rows with looping app animations */}
      <section className="landing-sec landing-light-2" id="features">
        <div className="wrap">
          <div className="landing-reveal">
            <div className="landing-kicker">One platform</div>
            <h2 className="landing-sec-h">
              Everything the desk needs.<br /><span className="pop">Nothing it doesn't.</span>
            </h2>
          </div>
          <div className="landing-frows">

            {/* 1 — Knowledge base */}
            <div className="frow landing-reveal">
              <div className="frow-text">
                <div className="frow-kick"><span className="fk-dot" style={{ background: '#e6097e' }} /> Knowledge base</div>
                <h3>Knowledge that answers</h3>
                <p>
                  Ask Tess synthesizes a real answer from your own help articles — and cites exactly
                  where it came from, so the whole desk can trust it.
                </p>
                <a className="frow-link" href={KNOWLEDGE_URL} target="_blank" rel="noreferrer">
                  Explore the knowledge base <span>→</span>
                </a>
              </div>
              <div className="frow-visual">
                <div className="vglow" style={{ background: 'radial-gradient(circle,rgba(230,9,126,.26),transparent 70%)' }} />
                <div className="appcard k2" aria-hidden="true">
                  <div className="ac-bar"><span className="ac-dots"><i /><i /><i /></span><span className="ac-label">Ask Tess</span></div>
                  <div className="k2-body">
                    <div className="k2-q">How do I get on the VPN?</div>
                    <div className="k2-think"><span className="landing-orb o3" /><span className="k2-dots"><i /><i /><i /></span></div>
                    <div className="k2-a">
                      <span className="k2-l k2-l1">Install <b>Acme Connect</b> from the Company Portal and sign in with SSO.</span>
                      <span className="k2-l k2-l2">Disconnect when you're done to keep things fast.</span>
                    </div>
                    <span className="k2-src">✦ Source: Connect to the VPN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2 — Smart intake */}
            <div className="frow rev landing-reveal">
              <div className="frow-text">
                <div className="frow-kick"><span className="fk-dot" style={{ background: '#ff5a3c' }} /> Smart intake</div>
                <h3>Intake that thinks</h3>
                <p>
                  Schema-driven forms where Tess reads the issue as it's typed, suggests a category,
                  and deflects to a known fix before a ticket is ever created.
                </p>
                <a className="frow-link" href={TOUR_URL} target="_blank" rel="noreferrer">
                  See the form builder <span>→</span>
                </a>
              </div>
              <div className="frow-visual">
                <div className="vglow" style={{ background: 'radial-gradient(circle,rgba(255,90,60,.24),transparent 70%)' }} />
                <div className="appcard i2" aria-hidden="true">
                  <div className="ac-bar"><span className="ac-dots"><i /><i /><i /></span><span className="ac-label">New request</span></div>
                  <div className="i2-body">
                    <div className="i2-label">Describe your issue</div>
                    <div className="i2-field"><span className="i2-typed">Can't connect to the VPN from home</span><span className="i2-caret" /></div>
                    <div className="i2-detect"><span className="li-orb" /> Detected <b>VPN access</b> · routed to IT</div>
                    <div className="i2-deflect">
                      <span className="i2-arrow">✦</span>
                      <div><b>Try this first:</b> Connect to the VPN<span className="i2-sub">Resolves most cases without a ticket</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 — Live dashboards */}
            <div className="frow landing-reveal">
              <div className="frow-text">
                <div className="frow-kick"><span className="fk-dot" style={{ background: '#0ea5e9' }} /> Live dashboards</div>
                <h3>Dashboards that surface</h3>
                <p>
                  Live SLA health, team load, and trends — with Tess flagging what needs you the
                  moment a ticket drifts toward a breach.
                </p>
                <a className="frow-link" href={DASHBOARDS_URL} target="_blank" rel="noreferrer">
                  Tour the dashboards <span>→</span>
                </a>
              </div>
              <div className="frow-visual">
                <div className="vglow" style={{ background: 'radial-gradient(circle,rgba(14,165,233,.24),transparent 70%)' }} />
                <div className="appcard d2" aria-hidden="true">
                  <div className="ac-bar"><span className="ac-dots"><i /><i /><i /></span><span className="ac-label">Overview</span></div>
                  <div className="d2-body">
                    <div className="d2-stats">
                      <div className="d2-stat"><span className="d2-n" data-to="94">94</span><span className="d2-u">%</span><em>SLA met</em></div>
                      <div className="d2-stat"><span className="d2-n" data-to="128">128</span><em>Open</em></div>
                      <div className="d2-stat"><span className="d2-n" data-to="12">12</span><em>Near breach</em></div>
                    </div>
                    <div className="d2-row"><span className="d2-k">SLA met</span><span className="d2-bar"><i className="g" style={{ width: '94%' }} /></span></div>
                    <div className="d2-row"><span className="d2-k">First response</span><span className="d2-bar"><i className="a" style={{ width: '78%' }} /></span></div>
                    <div className="d2-spark">
                      <svg viewBox="0 0 220 48" preserveAspectRatio="none">
                        <polyline
                          className="d2-line"
                          points="0,38 24,30 48,33 72,18 96,22 120,12 144,18 168,8 192,14 220,6"
                          fill="none" stroke="#0ea5e9" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="d2-flag"><span className="li-orb" /> 3 tickets near breach</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 — Make it yours */}
            <div className="frow rev landing-reveal">
              <div className="frow-text">
                <div className="frow-kick"><span className="fk-dot" style={{ background: '#16a34a' }} /> Make it yours</div>
                <h3>Yours to brand</h3>
                <p>
                  Recolor the entire workspace, drop in your logo, and shape your help center to
                  match. Self-hosted, on your servers, entirely on your terms.
                </p>
                <a className="frow-link" href={CONFIG_URL} target="_blank" rel="noreferrer">
                  Customize your workspace <span>→</span>
                </a>
              </div>
              <div className="frow-visual">
                <div className="vglow" style={{ background: 'radial-gradient(circle,rgba(139,92,246,.22),transparent 70%)' }} />
                <div className="appcard b2" aria-hidden="true">
                  <div className="ac-bar"><span className="ac-dots"><i /><i /><i /></span><span className="ac-label">Workspace · Branding</span></div>
                  <div className="b2-body">
                    <div className="b2-prev">
                      <div className="b2-side"><span className="b2-logo" /><span className="b2-nav on" /><span className="b2-nav" /><span className="b2-nav" /></div>
                      <div className="b2-main">
                        <div className="b2-hbar"><span className="b2-title" /><span className="b2-btn">New</span></div>
                        <div className="b2-line" /><div className="b2-line s" />
                        <div className="b2-chiprow"><span className="b2-chip on" /><span className="b2-chip" /><span className="b2-chip" /></div>
                      </div>
                    </div>
                    <div className="b2-swatches">
                      <span className="b2-k">Accent</span>
                      <span className="b2-sw" style={{ '--c': '#4f46e5' } as React.CSSProperties} />
                      <span className="b2-sw" style={{ '--c': '#16a34a' } as React.CSSProperties} />
                      <span className="b2-sw" style={{ '--c': '#e6097e' } as React.CSSProperties} />
                      <span className="b2-sw" style={{ '--c': '#ff5a3c' } as React.CSSProperties} />
                      <span className="b2-sw" style={{ '--c': '#0ea5e9' } as React.CSSProperties} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* PILLARS */}
          <div className="landing-metrics landing-reveal">
            <div className="landing-metric"><b>TRIAGE</b><span>Tess reads, routes &amp; resolves tickets automatically</span></div>
            <div className="landing-metric"><b>KNOWLEDGE</b><span>Answers synthesized from your own articles, with sources</span></div>
            <div className="landing-metric"><b>INTAKE</b><span>Schema-driven forms that deflect issues before they're filed</span></div>
            <div className="landing-metric"><b>YOURS</b><span>Self-hosted and fully brandable — your data, your servers</span></div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="landing-sec landing-light" id="compare">
        <div className="wrap">
          <div className="landing-center landing-reveal">
            <div className="landing-kicker">Why Tessio</div>
            <h2 className="landing-sec-h">ITSM that isn't<br />stuck in <span className="pop">2009.</span></h2>
            <p className="landing-sec-lead">
              The incumbents are powerful and painful. Tessio keeps the power and loses the pain.
            </p>
          </div>
          <div className="landing-compare">
            <div className="landing-col old landing-reveal">
              <div className="ch"><ClockIcon /> Legacy ITSM</div>
              <ul>
                {COMPARE_OLD.map((item) => (
                  <li key={item}><span className="ic"><XIcon /></span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="landing-col new landing-reveal d1">
              <div className="ch"><span className="o" /> Tessio</div>
              <ul>
                {COMPARE_NEW.map((item) => (
                  <li key={item}><span className="ic"><CheckSmall /></span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-sec landing-light-2" id="cta">
        <div className="wrap">
          <div className="landing-cta-band landing-reveal">
            <div className="tiles" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => <i key={i} />)}
            </div>
            <h2>Give your desk<br />an AI teammate.</h2>
            <p>Deploy the community edition with Docker Compose in about five minutes. Free to self-host, entirely on your servers.</p>
            <div className="landing-hero-cta">
              <a className="btn btn-white btn-lg" href={START_URL} target="_blank" rel="noreferrer">Get started — free</a>
              <a className="btn btn-glass btn-lg" href={GITHUB_URL} target="_blank" rel="noreferrer">View on GitHub</a>
            </div>
            <p className="landing-cta-docs">
              Prefer the details first? <a href={DOCS_URL} target="_blank" rel="noreferrer">Read the self-hosting docs</a> — live in about five minutes with Docker Compose.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="wrap">
          <div className="landing-foot-top">
            <div className="landing-foot-brand">
              <a className="landing-brand" href="#top"><span className="mark" />Tessio</a>
              <p>The self-hosted ITSM platform with an autonomous agent built in.</p>
            </div>
            <div className="landing-foot-col">
              <h4>Product</h4>
              <a href="#features">Tickets</a>
              <a href="#features">Knowledge Base</a>
              <a href="#features">Forms &amp; intake</a>
              <a href="#features">Dashboards</a>
            </div>
            <div className="landing-foot-col">
              <h4>Self-host</h4>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">Documentation</a>
              <a href={START_URL} target="_blank" rel="noreferrer">5-minute quickstart</a>
              <a href={COMPOSE_URL} target="_blank" rel="noreferrer">Docker Compose</a>
              <a href={K8S_URL} target="_blank" rel="noreferrer">Kubernetes (Helm)</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            </div>
            <div className="landing-foot-col">
              <h4>Get started</h4>
              <a href={START_URL} target="_blank" rel="noreferrer">Quickstart</a>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">Documentation</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </div>
          <div className="landing-foot-bot">
            <span>© 2026 Tessio. Self-hosted, on your terms.</span>
            <a className="landing-foot-sec" href={`${GITHUB_URL}/security/policy`} target="_blank" rel="noreferrer">
              Security policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
