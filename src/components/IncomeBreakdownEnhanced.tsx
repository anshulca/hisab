import { useState } from 'react';
import type { IncomeBreakdown } from '../types';
import { formatINR } from '../utils/currency';

interface IncomeBreakdownEnhancedProps {
  incomeData: IncomeBreakdown;
  onBack?: () => void;
}

export function IncomeBreakdownEnhanced({ incomeData, onBack }: IncomeBreakdownEnhancedProps) {
  const [showPercent, setShowPercent] = useState(false);

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Income Breakdown</h2>
            <p className="section-sub">Head-wise composition of gross total income.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn-ghost" onClick={() => setShowPercent((v) => !v)}>
              {showPercent ? 'Show amounts' : 'Show %'}
            </button>
          </div>
        </div>

        <div className="card">
          {incomeData.sources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No income sources recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="mini-table">
                <tbody>
                  {incomeData.sources.map((source) => (
                    <tr key={source.code}>
                      <td>
                        <strong>{source.label}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>{source.code}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{showPercent ? `${(source.percentage ?? 0).toFixed(1)}%` : formatINR(source.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--gold)' }}>
                    <td className="highlight">Gross Total Income</td>
                    <td className="highlight" style={{ textAlign: 'right' }}>
                      {showPercent ? '100%' : formatINR(incomeData.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Business / Profession</div>
            <div className="stat-value gold">{formatINR(incomeData.businessIncome)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Capital Gains</div>
            <div className="stat-value gold">{formatINR(incomeData.capitalGains)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Other Sources</div>
            <div className="stat-value gold">{formatINR(incomeData.otherSources)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}