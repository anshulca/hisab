import { useComputation } from '../hooks/useComputation';
import { formatINR } from '../utils/currency';
import { useState } from 'react';

interface ProfitAndLossWorkingProps {
  onBack?: () => void;
}

export function ProfitAndLossWorking({ onBack }: ProfitAndLossWorkingProps) {
  const { pnl, income, expenses, isReady, taxpayer } = useComputation();
  const [showDetail, setShowDetail] = useState(false);

  if (!isReady || !pnl || !income) {
    return <div className="section"><div className="container"><p style={{ color: 'var(--text-muted)' }}>No P&L data. Upload a file first.</p></div></div>;
  }

  const revenue = income.grossReceipts > 0 ? income.grossReceipts : income.businessIncome;

  const rows: Array<{ label: string; value: number; strong?: boolean }> = [
    { label: 'Revenue / Gross Receipts', value: revenue, strong: true },
    { label: 'Less: Cost of Goods Sold', value: pnl.cogs },
    { label: 'Gross Profit', value: pnl.grossProfit, strong: true },
    { label: 'Less: Operating Expenses', value: pnl.expenses },
    { label: 'Less: Depreciation', value: pnl.depreciation },
    { label: 'Operating Profit (EBITDA before depreciation)', value: pnl.ebitda },
    { label: 'Add: Other Income', value: pnl.otherIncome },
    { label: 'Net Profit (Business Income)', value: pnl.netProfit, strong: true }
  ];

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Profit & Loss Working</h2>
            <p className="section-sub">
              {taxpayer?.name ?? ''} · Reconstructed from the computation
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn-ghost" onClick={() => setShowDetail((v) => !v)}>
              {showDetail ? 'Hide' : 'Show'} detail
            </button>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Gross Margin</div>
            <div className="stat-value gold">{pnl.margins.gross.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Operating Margin</div>
            <div className="stat-value gold">{pnl.margins.operating.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Margin</div>
            <div className="stat-value gold">{pnl.margins.net.toFixed(1)}%</div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table className="mini-table">
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} style={row.strong ? { borderTop: '2px solid var(--gold)', background: 'var(--bg-secondary)' } : undefined}>
                    <td className={row.strong ? 'highlight' : ''}>{row.label}</td>
                    <td style={{ textAlign: 'right' }} className={row.strong ? 'highlight' : ''}>
                      {formatINR(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showDetail && expenses && expenses.items.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="card-title">Expense Breakup</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  {expenses.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(item.amount)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {item.percentage?.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}