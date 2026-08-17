import { useState } from 'react';
import type { MouseEvent } from 'react';

interface LandingProps {
  onGenerate: () => void;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Landing({ onGenerate }: LandingProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 8, y: -y * 6 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div className="landing">
      {/* HERO */}
      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="hero-badge">
              <i className="fas fa-circle" style={{ color: '#34d399', fontSize: '0.4rem' }} /> ITR COMPUTATION · AY 2026-27
            </div>
            <h1 className="hero-title">
              <span className="gold">HISAB,</span>
              <br />
              <span className="outline">JSON Upload Karo.</span>
              <br />
              <span className="gold">Computation Ready Karo.</span>
            </h1>
            <p className="hero-sub">
              Upload your ITR JSON file and in just 1 click, generate complete Tax Computation, P&L, Balance Sheet, and Depreciation Schedule.
            </p>
            <div className="hero-actions">
              <button className="btn-gold" onClick={onGenerate}>
                GENERATE MY HISAB <i className="fas fa-arrow-right" />
              </button>
              <button className="btn-ghost" onClick={() => scrollToSection('how')}>
                <i className="fas fa-play-circle" style={{ marginRight: 8 }} /> See how it works
              </button>
            </div>
          </div>

          <div className="hero-right" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="mockup-wrapper" style={{ transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}>
              <div className="mockup">
                <div className="mockup-header">
                  <div className="dots"><span /><span /><span /></div>
                  <span className="mock-title">
                    <i className="fas fa-file-invoice" style={{ marginRight: 6, color: 'var(--gold)' }} /> HISAB · AY 2026-27
                  </span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>DEMO</span>
                </div>
                <div className="mockup-body">
                  <div className="mock-card"><span className="label">Total Income</span><div className="value">₹12,45,800</div></div>
                  <div className="mock-card"><span className="label">Tax Liability</span><div className="value">₹24,500</div></div>
                  <div className="mock-card"><span className="label">Tax Paid</span><div className="value">₹32,000</div></div>
                  <div className="mock-card"><span className="label green">Refund</span><div className="value green">₹7,500</div></div>
                </div>
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                  <div className="mock-row"><span>Gross Receipts</span><span className="amount">₹25,00,000</span></div>
                  <div className="mock-row"><span>Business Income</span><span className="amount">₹2,00,000</span></div>
                  <div className="mock-row"><span>Other Income</span><span className="amount">₹50,000</span></div>
                </div>
              </div>
              <div className="floating-bubble bubble1"><i className="fas fa-check-circle" /> ITR-4 detected</div>
              <div className="floating-bubble bubble2"><i className="fas fa-chart-line" /> P&L ready</div>
              <div className="floating-bubble bubble3"><i className="fas fa-balance-scale" /> Balanced</div>
              <div className="particles">
                <div className="particle" style={{ top: '10%', left: '5%', animationDelay: '0s' }} />
                <div className="particle" style={{ top: '70%', left: '90%', animationDelay: '2s' }} />
                <div className="particle" style={{ top: '40%', left: '80%', animationDelay: '4s' }} />
                <div className="particle" style={{ top: '85%', left: '15%', animationDelay: '1s' }} />
                <div className="particle" style={{ top: '20%', left: '95%', animationDelay: '3s' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE PRODUCT PREVIEW */}
      <section className="section-preview" id="how">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="hero-badge" style={{ margin: '0 auto' }}> REAL-TIME PREVIEW</span>
            <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.6rem)', fontWeight: 600, marginTop: 10, color: 'var(--text)' }}>
              See your <span style={{ color: 'var(--gold)' }}>HISAB</span> in action
            </h2>
          </div>
          <div className="preview-window">
            <div className="window-bar">
              <div className="win-dots"><span /><span /><span /></div>
              <span className="win-title"><i className="fas fa-file-invoice" style={{ color: 'var(--gold)', marginRight: 8 }} /> HISAB · ITR Computation</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.55rem', color: 'var(--text-muted)' }}>demo</span>
            </div>
            <div className="window-body">
              <div className="win-left">
                <div className="mock-tab">
                  <span className="active">Tax Computation</span>
                  <span>P&L</span>
                  <span>Balance Sheet</span>
                  <span>Depreciation</span>
                </div>
                <div className="win-table">
                  <div className="row"><span>Gross Receipts</span><span className="amt">₹25,00,000</span></div>
                  <div className="row"><span>Business Income</span><span className="amt">₹2,00,000</span></div>
                  <div className="row"><span>Other Income</span><span className="amt">₹50,000</span></div>
                  <div className="row" style={{ borderTop: '2px solid var(--gold)', paddingTop: 10, fontWeight: 600 }}>
                    <span>Total Income</span><span className="amt" style={{ color: 'var(--gold-light)' }}>₹2,50,000</span>
                  </div>
                </div>
                <div className="check-row">
                  <span><i className="fas fa-check-circle" /> JSON Valid</span>
                  <span><i className="fas fa-check-circle" /> ITR-4</span>
                  <span><i className="fas fa-check-circle" /> AY 2026-27</span>
                  <span className="warn"><i className="fas fa-exclamation-triangle" /> Balance Sheet diff ₹25k</span>
                </div>
              </div>
              <div className="win-right">
                <div className="win-metric-grid">
                  <div className="win-metric"><span className="label">Tax Liability</span><div className="value">₹24,500</div></div>
                  <div className="win-metric"><span className="label">Tax Paid</span><div className="value">₹32,000</div></div>
                  <div className="win-metric"><span className="label">Refund</span><div className="value green">₹7,500</div></div>
                  <div className="win-metric">
                    <span className="label">Status</span>
                    <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: 6 }}>
                      <i className="fas fa-circle" style={{ fontSize: '0.4rem' }} /> Reconciled
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.02)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', border: '1px solid rgba(52,211,153,0.04)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <i className="fas fa-print" style={{ color: 'var(--gold)', marginRight: 8 }} /> Download / Print ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT FEELS */}
      <section className="section-feel">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <span className="hero-badge" style={{ margin: '0 auto' }}>EXPERIENCE</span>
            <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 600, marginTop: 8, color: 'var(--text)' }}>
              How it <span style={{ color: 'var(--gold)' }}>feels</span>
            </h2>
          </div>
          <div className="feel-grid">
            <div className="feel-card">
              <div className="icon"><i className="fas fa-bolt" /></div>
              <h4>Blazing fast</h4><p>From upload to reports in seconds. No waiting, no delays.</p>
            </div>
            <div className="feel-card">
              <div className="icon"><i className="fas fa-cube" /></div>
              <h4>Bouncy & alive</h4><p>Every hover, click, and transition feels responsive and energetic.</p>
            </div>
            <div className="feel-card">
              <div className="icon"><i className="fas fa-shield-alt" /></div>
              <h4>Privacy-first</h4><p>Your data stays on your device. No cloud uploads, no storage.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE SHOWCASE */}
      <section className="section-features" id="features">
        <div className="container feature-show">
          <div className="left">
            <span className="hero-badge">FEATURES</span>
            <h2>Everything you need, <span className="gold">nothing you don't.</span></h2>
            <p>Clean, professional reports built from your ITR JSON. No spreadsheets, no manual work.</p>
            <div className="feature-list">
              <div className="item"><i className="fas fa-check-circle" /> Tax Computation with breakdown</div>
              <div className="item"><i className="fas fa-check-circle" /> P&L Statement & Balance Sheet</div>
              <div className="item"><i className="fas fa-check-circle" /> Depreciation Schedule</div>
              <div className="item"><i className="fas fa-check-circle" /> HISAB Check - reconcile instantly</div>
            </div>
          </div>
          <div className="right">
            <div className="stat"><div className="num">100%</div><div className="desc">local processing</div></div>
            <div className="stat"><div className="num">4</div><div className="desc">reports in 1 click</div></div>
            <div className="stat"><div className="num">JSON</div><div className="desc">from ITR e-filing</div></div>
            <div className="stat"><div className="num">₹0</div><div className="desc">free to try</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}