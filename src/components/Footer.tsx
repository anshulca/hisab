import { useState } from 'react';

interface FooterProps {
  onNavigate?: (section: string) => void;
}

function scrollToSection(id: string, onNavigate?: (s: string) => void) {
  if (!onNavigate) return;
  onNavigate('hero');
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

type DocKey = 'privacy' | 'disclaimer';

const DOCS: Record<DocKey, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'HISAB processes all ITR JSON files entirely in your browser. Uploaded files are never transmitted to, or stored on, any server.',
      'All computations (income, depreciation, tax) happen locally in your device. Nothing leaves your browser session.',
      'HISAB does not set tracking cookies, does not log your PAN, name, income figures or any tax data, and has no backend database.',
      'Site analytics, if used, are limited to anonymous, aggregate page-level counts with no personal or tax information.',
      'You can wipe everything at any time by refreshing the page or clearing your browser data.'
    ]
  },
  disclaimer: {
    title: 'Disclaimer',
    body: [
      'HISAB is a free utility tool built for quick cross-checks of ITR computations. It is NOT a substitute for professional tax advice or the official Income Tax Department website.',
      'While every effort is made to keep the calculations accurate, the output may contain errors - this tool does not guarantee completeness, accuracy or tax-compliant filing.',
      'The final responsibility for filing a correct and complete return rests solely with the taxpayer, through the official e-filing portal (incometax.gov.in).',
      'HISAB and its creator (CA Anshul Karwa, per applicable disclosures) accept no liability for any loss, tax demand, penalty, or other consequences arising from reliance on this tool.',
      'This is a personal project; by using it you agree to use the results at your own risk and to verify them against official records before filing.'
    ]
  }
};

function PolicyModal({ docKey, onClose }: { docKey: DocKey; onClose: () => void }) {
  const doc = DOCS[docKey];
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,6,12,0.66)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        padding: 24,
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h3 className="card-title" style={{ color: 'var(--gold)' }}>{doc.title}</h3>
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '6px 10px', lineHeight: 1 }}
          >✕</button>
        </div>
        {doc.body.map((para, i) => (
          <p key={i} className="card-sub" style={{ marginBottom: 10 }}>{para}</p>
        ))}
        <p className="card-sub" style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

export function Footer({ onNavigate }: FooterProps) {
  const year = new Date().getFullYear();
  const [doc, setDoc] = useState<DocKey | null>(null);

  const openDoc = (key: DocKey) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setDoc(key);
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="logo">HIS<span>AB</span></span>
            <p>JSON se Computation tak.</p>
            <p className="by">
              By <a href="https://www.linkedin.com/in/anshulkarwa/" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>CA Anshul Karwa</a>
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ITR computation, simplified.</p>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <a href="#app" onClick={(e) => { e.preventDefault(); onNavigate?.('app'); }}>Generate HISAB</a>
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollToSection('how', onNavigate); }}>How It Works</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features', onNavigate); }}>Features</a>
            <a href="#hisab" onClick={(e) => { e.preventDefault(); onNavigate?.('hisabCheck'); }}>HISAB Check</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Pricing</a>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollToSection('how', onNavigate); }}>How to get ITR JSON</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features', onNavigate); }}>ITR-4</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features', onNavigate); }}>AY 2026-27</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Help / FAQ</a>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#" onClick={openDoc('privacy')}>Privacy Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={openDoc('disclaimer')}>Disclaimer</a>
            <div style={{ marginTop: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Built by CA Anshul Karwa</span>
              <br />
              <a href="https://hisab.studyfromnotes.com" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', fontWeight: 500 }}>
                hisab.studyfromnotes.com
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} HISAB. All rights reserved. <strong>HISAB is a product by CA Anshul Karwa.</strong></span>
          <span className="privacy-note"><i className="fas fa-lock" /> Your tax data is processed with privacy in mind.</span>
        </div>
      </div>
      {doc && <PolicyModal docKey={doc} onClose={() => setDoc(null)} />}
    </footer>
  );
}