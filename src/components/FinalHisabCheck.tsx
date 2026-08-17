import { useState } from 'react';
import { useComputation } from '../hooks/useComputation';
import { formatINR } from '../utils/currency';

interface FinalHisabCheckProps {
  onNavigate: (section: string) => void;
  onFinalize: () => void;
}

interface Point {
  id: string;
  title: string;
  description: string;
  target: string;
}

const POINTS: Point[] = [
  { id: '1', title: 'Income & P&L agree', description: 'Business income in the P&L matches the income head.', target: 'pnl' },
  { id: '2', title: 'Expenses are admissible', description: 'Every expense is accounted and categorized.', target: 'pnl' },
  { id: '3', title: 'Depreciation claimed correctly', description: 'Block rates & WDV recomputed and saved.', target: 'depreciation' },
  { id: '4', title: 'Tax computed in chosen regime', description: 'Slabs, surcharge & cess applied on taxable income.', target: 'review' },
  { id: '5', title: 'Prepaid taxes adjusted', description: 'Advance tax & TDS deducted from total tax.', target: 'review' }
];

export function FinalHisabCheck({ onNavigate, onFinalize }: FinalHisabCheckProps) {
  const { tax, isReady, taxpayer, income, expenses, depreciation } = useComputation();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!isReady || !tax) {
    return <div className="section"><div className="container"><p style={{ color: 'var(--text-muted)' }}>Upload a file first.</p></div></div>;
  }

  const allChecked = POINTS.every((point) => checked[point.id]);

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="section-head">
          <h2 className="section-title">Final Hisab Check</h2>
          <p className="section-sub">
            {taxpayer?.name} · PAN {taxpayer?.pan} · AY {taxpayer?.assessmentYear}
          </p>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {POINTS.map((point) => (
            <div
              key={point.id}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, cursor: 'pointer', borderColor: checked[point.id] ? 'var(--gold)' : 'var(--border)' }}
              onClick={() => setChecked((prev) => ({ ...prev, [point.id]: !prev[point.id] }))}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: checked[point.id] ? 'var(--gold)' : 'var(--bg-secondary)', color: checked[point.id] ? '#0a0b12' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {checked[point.id] ? '✓' : point.id}
                </span>
                <div>
                  <strong>{point.title}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{point.description}</div>
                </div>
              </div>
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onNavigate(point.target); }}>Open →</button>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="card-title">Computation Summary</h3>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="mini-table">
              <tbody>
                <tr><td>Gross Total Income</td><td style={{ textAlign: 'right' }}>{formatINR(income?.total ?? 0)}</td></tr>
                <tr><td>Total Expenses</td><td style={{ textAlign: 'right' }}>{formatINR(expenses?.total ?? 0)}</td></tr>
                <tr><td>Depreciation Claimed</td><td style={{ textAlign: 'right' }}>{formatINR(depreciation.reduce((s, a) => s + a.depreciation, 0))}</td></tr>
                <tr><td>Taxable Income</td><td style={{ textAlign: 'right' }}>{formatINR(tax.taxableIncome)}</td></tr>
                <tr><td><strong>Net Tax Payable</strong></td><td className="highlight" style={{ textAlign: 'right' }}><strong>{formatINR(tax.netTaxPayable)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
          <button className="btn-ghost" onClick={() => onNavigate('review')}>← Back to Review</button>
          <button className="btn-gold" onClick={onFinalize} disabled={!allChecked} title={allChecked ? '' : 'Complete all 5 checks to finalize'}>
            {allChecked ? '✓ Finalize Computation' : 'Complete all checks to finalize'}
          </button>
        </div>

        {!allChecked && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 12 }}>
            {Object.values(checked).filter(Boolean).length}/{POINTS.length} checks completed
          </p>
        )}
      </div>
    </div>
  );
}