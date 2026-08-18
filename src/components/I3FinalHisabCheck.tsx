import { useComputationStore } from '../store/computationStore';
import { buildItr3Report } from '../itr3/report';
import { generateItr3Pdf } from '../itr3/pdf';
import { formatINR } from '../utils/currency';

interface I3FinalHisabCheckProps {
  onNavigate: (section: string) => void;
  onFinalize: () => void;
}

export function I3FinalHisabCheck({ onNavigate, onFinalize }: I3FinalHisabCheckProps) {
  const normalizedData = useComputationStore((s) => s.normalizedData);
  const isFinalized = useComputationStore((s) => s.isFinalized);

  if (!normalizedData?.itr3) {
    return (
      <div className="section">
        <div className="container"><p style={{ color: 'var(--text-muted)' }}>Upload a file first.</p></div>
      </div>
    );
  }

  const report = buildItr3Report(normalizedData);
  const taxpayer = normalizedData.taxpayer;
  const checks = report.hisabCheck;
  const allPass = report.checksAllPass;

  const handleDownload = async () => {
    await generateItr3Pdf(normalizedData);
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="section-head">
          <h2 className="section-title">Final Hisab Check — ITR-3</h2>
          <p className="section-sub">
            {taxpayer.name} · PAN {taxpayer.pan} · AY {taxpayer.assessmentYear}
          </p>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {checks.map((check, i) => (
            <div
              key={i}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, borderColor: check.pass ? 'rgba(34,150,90,0.4)' : 'rgba(220,80,80,0.4)' }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                <span
                  style={{
                    width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, background: check.pass ? 'rgba(34,150,90,0.15)' : 'rgba(220,80,80,0.12)',
                    color: check.pass ? 'var(--green, #22965a)' : 'var(--red, #dc5050)', border: '1px solid currentColor'
                  }}
                >
                  {check.pass ? '✓' : '!'}
                </span>
                <div>
                  <strong>{check.label}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{check.value}</div>
                  {check.note && <div style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>{check.note}</div>}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: check.pass ? 'var(--green, #22965a)' : 'var(--red, #dc5050)' }}>
                {check.pass ? 'OK' : 'CHECK'}
              </span>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="card-title">Computation Summary</h3>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="mini-table">
              <tbody>
                <tr><td>Gross Total Income (sum of heads)</td><td style={{ textAlign: 'right' }}>{formatINR(report.income.grossTotal)}</td></tr>
                <tr><td>Total Income (as per ITR)</td><td style={{ textAlign: 'right' }}>{formatINR(report.income.totalIncome)}</td></tr>
                <tr><td>Total Deductions (u/s 80C–80U)</td><td style={{ textAlign: 'right' }}>{formatINR(report.totalDeductions)}</td></tr>
                <tr><td>Total Tax (as per ITR)</td><td style={{ textAlign: 'right' }}>{formatINR(report.taxComputed.grossLiability)}</td></tr>
                <tr><td>Total Taxes Paid</td><td style={{ textAlign: 'right' }}>{formatINR(report.taxesPaid.total)}</td></tr>
                <tr><td><strong>Aggregate Tax & Interest</strong></td><td className="highlight" style={{ textAlign: 'right' }}><strong>{formatINR(report.taxComputed.aggregateLiability)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
          <button className="btn-ghost" onClick={() => onNavigate('review')}>← Back to Review</button>
          <button className="btn-ghost" onClick={handleDownload}>⬇ PDF</button>
          <button className="btn-gold" onClick={onFinalize} disabled={!allPass} title={allPass ? '' : 'Resolve all CHECK items to finalize'}>
            {isFinalized ? '✓ Finalized' : allPass ? '✓ Finalize Computation' : 'Complete checks to finalize'}
          </button>
        </div>

        {!allPass && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 12 }}>
            {checks.filter((c) => c.pass).length}/{checks.length} checks reconciled — resolve the remaining differences before finalising.
          </p>
        )}
      </div>
    </div>
  );
}