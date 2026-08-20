import { useState } from 'react';

export type LegalTab = 'faq' | 'privacy' | 'terms' | 'disclaimer';

interface LegalPageProps {
  initialTab?: LegalTab;
  onNavigate: (section: string) => void;
}

const TABS: { key: LegalTab; label: string; icon: string }[] = [
  { key: 'faq', label: 'FAQ', icon: 'fa-circle-question' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'fa-shield-halved' },
  { key: 'terms', label: 'Terms of Use', icon: 'fa-file-contract' },
  { key: 'disclaimer', label: 'Disclaimer', icon: 'fa-triangle-exclamation' }
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What is HISAB?',
    a: 'HISAB is a free utility that reads the ITR JSON file downloaded from the income tax e-filing portal and computes the income breakdown, depreciation, tax and final hisab (reconciliation) in your browser.'
  },
  {
    q: 'Which ITR forms are supported?',
    a: 'ITR-1 (SAHAJ), ITR-2, ITR-3 and ITR-4 (SUGAM) JSON files are supported. The form is detected automatically from the file structure.'
  },
  {
    q: 'Which assessment years work?',
    a: 'Files for AY 2024-25, AY 2025-26 and AY 2026-27 (or earlier years) can be processed. Tax slabs and rebates are applied based on the assessment year found in the file.'
  },
  {
    q: 'Is my tax data safe?',
    a: 'Yes. Your file is processed entirely in your browser - nothing is uploaded, transmitted or stored on any server. Refresh the page to clear everything from memory.'
  },
  {
    q: 'Can I use this instead of a CA or the official portal?',
    a: 'No. HISAB is a quick cross-check tool only. The final return must be filed on the official e-filing portal, and professional advice should be taken for complex cases.'
  },
  {
    q: 'How do I download the ITR JSON file?',
    a: 'Log in to the e-filing portal, go to E-File > Income Tax Returns > View Filed Returns, choose the return, and use the "Download JSON" option available there.'
  },
  {
    q: 'Does HISAB need internet?',
    a: 'No. Once the page is loaded, all computation happens offline in your browser. Nothing is sent over the network.'
  },
  {
    q: 'What if the numbers look wrong?',
    a: 'Check the BETA parsing notes on the review screen - some fields may not be present in every export. For a definitive answer, verify against the computation sheet in the official portal.'
  }
];

const PRIVACY_POINTS = [
  'All processing happens in your browser. Uploaded ITR JSON files are never sent to, or stored on, any server.',
  'HISAB has no backend database and does not collect your PAN, name, income, asset or tax figures.',
  'No personal or tax information is logged, tracked or shared with any third party.',
  'Cookies: HISAB does not use tracking cookies. Any storage used is limited to cosmetic preferences (e.g. theme choice) stored on your own device.',
  'Analytics, if enabled, are anonymous and aggregate (page-level counts only) with no tax or personal data.',
  'You can remove all local data at any time by clearing your browser site data or using a private/incognito window.',
  'HISAB is a client-side utility; privacy protection is therefore as strong as the browser itself on your device.'
];

const TERMS_POINTS = [
  'By using HISAB you accept these terms. The tool is provided free of charge for personal, non-commercial use.',
  'HISAB is not affiliated with, or endorsed by, the Income Tax Department or any government body.',
  'The software is provided "as is" without warranties of any kind - implied or expressed - including accuracy, completeness or fitness for a particular purpose.',
  'You are solely responsible for the correctness of the information you provide and for filing your return through the official channel.',
  'Do not reverse-engineer, decompile or misuse the tool or its protected code; it is offered for lawful personal use only.',
  'We may update these terms or change the tool at any time without prior notice.',
  'Commercial redistribution or resale of HISAB or its outputs is not permitted without written consent.'
];

const DISCLAIMER_POINTS = [
  'HISAB is an independent utility built for quick cross-checks. It is not a substitute for professional tax, legal or financial advice.',
  'While reasonable care is taken, the tool may contain errors. Figures produced here must be verified before filing.',
  'The final return and its correctness remain the responsibility of the taxpayer. Always file through the official e-filing portal (incometax.gov.in).',
  'Neither HISAB nor its creator is liable for any loss, tax demand, interest, penalty or any other consequence arising from the use of this tool.',
  'Regime selection, exemptions, deductions and tax treatment in the tool are approximations of the Income Tax Act as applicable; they may not cover every taxpayer scenario.',
  'For complex cases (capital gains, international income, presumptive schemes, etc.), please consult a qualified chartered accountant.'
];

const CONTENT: Record<LegalTab, { title: string; intro: string; body: string[] }> = {
  faq: {
    title: 'Frequently Asked Questions',
    intro: 'Quick answers to the most common questions about HISAB.',
    body: []
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'Your data stays on your device. That is the whole policy in one line.',
    body: PRIVACY_POINTS
  },
  terms: {
    title: 'Terms of Use',
    intro: 'The simple rules under which HISAB is offered.',
    body: TERMS_POINTS
  },
  disclaimer: {
    title: 'Disclaimer',
    intro: 'Please read this before relying on any number produced by the tool.',
    body: DISCLAIMER_POINTS
  }
};

export function LegalPage({ initialTab = 'faq', onNavigate }: LegalPageProps) {
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const active = CONTENT[tab];

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div style={{ textAlign: 'center', margin: '48px auto 0' }}>
          <span className="hero-badge" style={{ margin: '0 auto' }}>
            <i className="fas fa-scroll" style={{ fontSize: '0.4rem' }} /> HELP & LEGAL
          </span>
          <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 600, marginTop: 10, color: 'var(--text)' }}>
            FAQ · Privacy · <span style={{ color: 'var(--gold)' }}>Terms · Disclaimer</span>
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            flexWrap: 'wrap',
            margin: '26px 0 28px'
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'btn-gold' : 'btn-ghost'}
              onClick={() => setTab(t.key)}
              style={{ padding: '9px 16px' }}
            >
              <i className={`fas ${t.icon}`} style={{ marginRight: 6, fontSize: '0.7rem' }} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 30 }}>
          <h3 className="card-title" style={{ color: 'var(--gold)' }}>
            <i className={`fas ${TABS.find((t) => t.key === tab)?.icon}`} style={{ marginRight: 8 }} />
            {active.title}
          </h3>
          <p className="card-sub" style={{ marginTop: 4, marginBottom: 16 }}>{active.intro}</p>

          {tab === 'faq' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 16px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 10,
                    background: 'var(--bg-secondary)'
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 6 }}>{item.q}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.a}</span>
                </div>
              ))}
            </div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10 }}>
              {active.body.map((point, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                  {point}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ textAlign: 'center', margin: '28px 0 8px' }}>
          <button className="btn-gold" onClick={() => onNavigate('hero')}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}