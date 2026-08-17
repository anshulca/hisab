import { useState } from 'react';
import { useComputation } from '../hooks/useComputation';
import { formatINR } from '../utils/currency';

interface HisabCheckProps {
  onNavigate: (section: string) => void;
}

interface CheckItem {
  id: string;
  label: string;
  detail: string;
  target: string;
}

const CHECK_ITEMS: CheckItem[] = [
  { id: 'income', label: 'Income matches source data', detail: 'All income heads are pulled and reconciled.', target: 'income' },
  { id: 'expenses', label: 'Expenses are complete & categorized', detail: 'Every expense line is mapped to a category.', target: 'pnl' },
  { id: 'depreciation', label: 'Depreciation schedule is correct', detail: 'Block rates and WDV are verified.', target: 'depreciation' },
  { id: 'tax', label: 'Tax computed on the right regime', detail: 'New/Old regime slabs & cess applied.', target: 'pnl' },
  { id: 'final', label: 'Prepaid taxes (Advance/TDS) accounted', detail: 'Net tax payable is after all prepaid taxes.', target: 'hisabCheck' }
];

export function HisabCheck({ onNavigate }: HisabCheckProps) {
  const { tax, isReady } = useComputation();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  if (!isReady || !tax) {
    return <div className="card" style={{ padding: 50, textAlign: 'center' }}><p style={{ color: 'var(--text-muted)' }}>Upload a file to begin the Hisab check.</p></div>;
  }

  const allChecked = CHECK_ITEMS.every((item) => checked[item.id]);

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="section-head">
          <h2 className="section-title">Hisab Check</h2>
          <p className="section-sub">Verify each stage of the computation before finalizing.</p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {CHECK_ITEMS.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                cursor: 'pointer',
                borderColor: checked[item.id] ? 'var(--gold)' : 'var(--border)'
              }}
              onClick={() => toggle(item.id)}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    background: checked[item.id] ? 'var(--gold)' : 'var(--bg-secondary)',
                    color: checked[item.id] ? '#0a0b12' : 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {checked[item.id] ? '✓' : ''}
                </span>
                <div>
                  <strong style={{ display: 'block' }}>{item.label}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.detail}</span>
                </div>
              </div>
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onNavigate(item.target); }}>
                Open →
              </button>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24, textAlign: 'center', background: allChecked ? 'var(--gold-glow)' : undefined }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {allChecked
              ? '✓ All checks complete — the computation is internally consistent.'
              : `${Object.values(checked).filter(Boolean).length}/${CHECK_ITEMS.length} checks done.`}
          </p>
          <p className="card-sub" style={{ marginTop: 6 }}>Net tax payable: {formatINR(tax.netTaxPayable)}</p>
        </div>
      </div>
    </div>
  );
}