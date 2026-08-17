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

export function Footer({ onNavigate }: FooterProps) {
  const year = new Date().getFullYear();

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
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Disclaimer</a>
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
    </footer>
  );
}