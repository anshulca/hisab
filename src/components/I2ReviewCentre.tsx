import { useComputationStore } from '../store/computationStore';
import { useGuardedDownload } from '../hooks/useGuardedDownload';
import { generateItr2Pdf } from '../itr2/pdf';
import { buildItr2Report, maskPan } from '../itr2/report';
import { compactINR, formatINR } from '../utils/currency';

interface I2ReviewCentreProps {
  onNavigate: (section: string) => void;
}

export function I2ReviewCentre({ onNavigate }: I2ReviewCentreProps) {
  const normalizedData = useComputationStore((s) => s.normalizedData);
  const upload = useComputationStore((s) => s.upload);
  const itrForm = useComputationStore((s) => s.itrForm);
  const handleDownload = useGuardedDownload(async () => {
    if (normalizedData) await generateItr2Pdf(normalizedData);
  });

  if (!normalizedData?.itr2) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: 80 }}>
          <h2 className="section-title">No data yet</h2>
          <p className="section-sub" style={{ margin: '12px 0 24px' }}>Upload an ITR-2 JSON file to generate the computation.</p>
          <button className="btn-gold" onClick={() => onNavigate('app')}>← Go to Upload</button>
        </div>
      </div>
    );
  }

  const d = normalizedData.itr2;
  const report = buildItr2Report(normalizedData);
  const taxpayer = normalizedData.taxpayer;

  const quickFacts = [
    { label: 'Total Income', value: compactINR(d.income.totalIncome || report.income.grossTotal) },
    { label: 'Tax Liability', value: compactINR(d.taxComputed.grossTaxLiability) },
    { label: 'Taxes Paid', value: compactINR(d.taxesPaid.total) },
    { label: 'Refund / Payable', value: d.refund.refundDue > 0 ? compactINR(d.refund.refundDue) + ' refund' : compactINR(d.taxesPaid.balancePayable) + ' payable' }
  ];

  const regimeLabel = taxpayer.regime === 'old' ? 'Old Regime' : 'New Regime (115BAC)';

  return (
    <div className="section">
      <div className="container">
        {upload.issues.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(212,168,84,0.45)', background: 'rgba(212,168,84,0.06)' }}>
            <h3 className="card-title" style={{ color: 'var(--gold)' }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} /> BETA Parsing Note
            </h3>
            <p className="card-sub" style={{ marginTop: 6 }}>
              {upload.issues.map((issue) => issue.message).join(' ')}
            </p>
          </div>
        )}

        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Review Centre — ITR-2</h2>
            <p className="section-sub">
              <span className="hero-badge" style={{ fontSize: '0.55rem', marginRight: 8 }}>
                <i className="fas fa-check-circle" style={{ fontSize: '0.4rem' }} /> {itrForm === 'ITR2' ? 'ITR-2 DETECTED' : itrForm}
              </span>
              {taxpayer.name} · PAN {maskPan(taxpayer.pan)} · AY {taxpayer.assessmentYear} · {regimeLabel}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={handleDownload}>⬇ PDF</button>
            <button className="btn-gold" onClick={() => onNavigate('hisabCheck')}>Final Hisab →</button>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                  {d.income.salary !== 0 && <tr><td>Income from Salary</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.salary)}</td></tr>}
                  {d.income.houseProperty !== 0 && <tr><td>Income from House Property</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.houseProperty)}</td></tr>}
                  {d.income.capitalGains !== 0 && <tr><td>Capital Gains</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.capitalGains)}</td></tr>}
                  {d.income.otherSources !== 0 && <tr><td>Income from Other Sources</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.otherSources)}</td></tr>}
                  <tr>
                    <td><strong>Gross Total Income</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatINR(d.income.grossTotal)}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Total Income</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatINR(d.income.totalIncome)}</strong></td>
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
                  {d.taxComputed.taxNormal !== 0 && <tr><td>Tax on income (normal rates)</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.taxNormal)}</td></tr>}
                  {d.taxComputed.taxSpecialRates !== 0 && <tr><td>Tax on special-rate incomes</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.taxSpecialRates)}</td></tr>}
                  {d.taxComputed.surcharge !== 0 && <tr><td>Surcharge</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.surcharge)}</td></tr>}
                  {d.taxComputed.educationCess !== 0 && <tr><td>Health & Ed. cess</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.educationCess)}</td></tr>}
                  <tr><td><strong>Total Tax</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(d.taxComputed.grossTaxLiability)}</strong></td></tr>
                  {d.taxComputed.totalInterest !== 0 && <tr><td>Add: Interest u/s 234A/B/C</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.totalInterest)}</td></tr>}
                  <tr><td><strong>Aggregate Tax & Interest</strong></td><td className="highlight" style={{ textAlign: 'right' }}><strong>{formatINR(d.taxComputed.aggregateLiability)}</strong></td></tr>
                  <tr><td>Taxes Paid</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxesPaid.total)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {report.deductions.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="card-title">Chapter VI-A Deductions</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  {report.deductions.map((x) => (
                    <tr key={x.code}><td>Deduction u/s {x.code}</td><td style={{ textAlign: 'right' }}>{formatINR(x.amount)}</td></tr>
                  ))}
                  <tr><td><strong>Total Deductions</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(report.totalDeductions)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="card-title">Working Sections</h3>
          <p className="card-sub">Open any section of the ITR-2 working file.</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              ['report', 'Computation Report'],
              ['hisabCheck', 'Final Hisab Check']
            ].map(([key, label]) => (
              <button key={key} className="btn-ghost" onClick={() => onNavigate(key)} style={{ textAlign: 'center' }}>
                {label} →
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}