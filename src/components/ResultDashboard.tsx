import { useComputation } from '../hooks/useComputation';
import { compactINR } from '../utils/currency';

interface ResultDashboardProps {
  onViewReport?: () => void;
}

export function ResultDashboard({ onViewReport }: ResultDashboardProps) {
  const { taxpayer, income, tax, expenses, isReady } = useComputation();

  if (!isReady || !taxpayer || !income || !tax) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: 'var(--text-muted)' }}>No computation yet. Upload an ITR JSON to begin.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Gross Income', value: compactINR(income.total) },
    { label: 'Taxable Income', value: compactINR(tax.taxableIncome) },
    { label: 'Total Tax', value: compactINR(tax.totalTax) },
    { label: 'Net Payable', value: compactINR(tax.netTaxPayable) }
  ];

  return (
    <div>
      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value gold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title">{taxpayer.name}</h3>
            <p className="card-sub">
              PAN {taxpayer.pan} · AY {taxpayer.assessmentYear} · {taxpayer.profession ?? taxpayer.type}
            </p>
          </div>
          {onViewReport && (
            <button className="btn-gold" onClick={onViewReport}>
              View Report →
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
          <div>
            <div className="stat-label">Business Income</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{compactINR(income.businessIncome)}</div>
          </div>
          <div>
            <div className="stat-label">Expenses</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{compactINR(expenses?.total ?? 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}