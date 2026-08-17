import { useComputation } from '../hooks/useComputation';
import { ResultDashboard } from './ResultDashboard';
import { generatePdf } from '../pdf/pdfGenerator';
import { formatINR, compactINR } from '../utils/currency';

interface ReviewCentreProps {
  onNavigate: (section: string) => void;
}

export function ReviewCentre({ onNavigate }: ReviewCentreProps) {
  const { normalizedData, taxpayer, income, tax, isReady, reportSections } = useComputation();

  const handleDownload = () => {
    if (normalizedData) generatePdf(normalizedData);
  };

  if (!isReady || !taxpayer || !income || !tax) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: 80 }}>
          <h2 className="section-title">No data yet</h2>
          <p className="section-sub" style={{ margin: '12px 0 24px' }}>
            Upload an ITR-4 JSON file from the home page to generate the computation.
          </p>
          <button className="btn-gold" onClick={() => onNavigate('hero')}>← Go to Upload</button>
        </div>
      </div>
    );
  }

  const quickFacts = [
    { label: 'Business Income', value: compactINR(income.businessIncome) },
    { label: 'Gross Total Income', value: compactINR(income.total) },
    { label: 'Taxable Income', value: compactINR(tax.taxableIncome) },
    { label: 'Net Tax Payable', value: compactINR(tax.netTaxPayable) }
  ];

  return (
    <div className="section">
      <div className="container">
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Review Centre</h2>
            <p className="section-sub">
              {taxpayer.name} · AY {taxpayer.assessmentYear} · {taxpayer.profession ?? taxpayer.type}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={handleDownload}>⬇ PDF</button>
            <button className="btn-gold" onClick={() => onNavigate('hisabCheck')}>Final Hisab →</button>
          </div>
        </div>

        <ResultDashboard onViewReport={() => onNavigate('review')} />

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 20 }}>
          {quickFacts.map((fact) => (
            <div key={fact.label} className="stat-card">
              <div className="stat-label">{fact.label}</div>
              <div className="stat-value gold">{fact.value}</div>
            </div>
          ))}
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 20 }}>
          <div className="card">
            <h3 className="card-title">Income Heads</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  {income.sources.map((source) => (
                    <tr key={source.code}>
                      <td>{source.label}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(source.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatINR(income.total)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Tax Computation</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  <tr><td>Tax before cess</td><td style={{ textAlign: 'right' }}>{formatINR(tax.taxBeforeCess)}</td></tr>
                  <tr><td>Surcharge</td><td style={{ textAlign: 'right' }}>{formatINR(tax.surcharge)}</td></tr>
                  <tr><td>Health & Ed. cess (4%)</td><td style={{ textAlign: 'right' }}>{formatINR(tax.healthCess)}</td></tr>
                  <tr><td><strong>Total tax</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(tax.totalTax)}</strong></td></tr>
                  <tr><td>Effective rate</td><td style={{ textAlign: 'right' }}>{tax.effectiveRate.toFixed(2)}%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="card-title">Working Sections</h3>
          <p className="card-sub">Open any section of the working file.</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              ['income', 'Income Breakdown'],
              ['pnl', 'P&L Working'],
              ['depreciation', 'Depreciation Schedule'],
              ['hisabCheck', 'Final Hisab Check']
            ].map(([key, label]) => (
              <button key={key} className="btn-ghost" onClick={() => onNavigate(key)} style={{ textAlign: 'center' }}>
                {label} →
              </button>
            ))}
          </div>
        </div>

        {reportSections.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="card-title">Generated Sections</h3>
            <p className="card-sub">{reportSections.length} report sections are ready to download.</p>
          </div>
        )}
      </div>
    </div>
  );
}