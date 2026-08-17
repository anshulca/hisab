import { UploadCard } from './UploadCard';

interface HeroProps {
  onGenerate: () => void;
}

export function Hero({ onGenerate }: HeroProps) {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <h1 className="hero-title">
              JSON se <span className="gold">Computation</span> tak.
            </h1>
            <p className="hero-sub">
              HISAB turns your ITR export JSON into a full computation — income, expenses,
              depreciation, tax and a report you can trust. Built by CA Anshul Karwa.
            </p>
            <div className="hero-badges">
              <span className="badge">ITR-4 · Sugam</span>
              <span className="badge">44AD / 44ADA</span>
              <span className="badge">New & Old Regime</span>
              <span className="badge">Instant PDF Report</span>
            </div>
            <UploadCard onGenerated={onGenerate} />
          </div>
          <div className="card" style={{ padding: 36 }}>
            <h3 className="card-title">What you get</h3>
            <p className="card-sub">A complete working file, verified end to end.</p>
            <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
              {[
                ['01', 'Income head-wise breakdown'],
                ['02', 'Presumptive / actual expense working'],
                ['03', 'Depreciation schedule (block-wise)'],
                ['04', 'Tax computation with cess & prepaid tax'],
                ['05', 'Final Hisab 5-point checklist']
              ].map(([num, label]) => (
                <div key={num} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{num}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="stat-grid" style={{ marginTop: 30, gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card">
                <div className="stat-label">Regimes</div>
                <div className="stat-value gold">2</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Form</div>
                <div className="stat-value gold">ITR-4</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}