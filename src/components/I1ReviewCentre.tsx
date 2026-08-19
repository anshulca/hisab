import { useComputationStore } from '../store/computationStore';
import { generateItr1Pdf } from '../itr1/pdf';
import { buildItr1Report } from '../itr1/report';
import { compactINR, formatINR } from '../utils/currency';

interface I1ReviewCentreProps {
  onNavigate: (section: string) => void;
}

export function I1ReviewCentre({ onNavigate }: I1ReviewCentreProps) {
  const normalizedData = useComputationStore((s) => s.normalizedData);
  const upload = useComputationStore((s) => s.upload);
  const itrForm = useComputationStore((s) => s.itrForm);

  if (!normalizedData?.itr1) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: 80 }}>
          <h2 className="section-title">No data yet</h2>
          <p className="section-sub" style={{ margin: '12px 0 24px' }}>Upload an ITR-1 JSON file to generate the computation.</p>
          <button className="btn-gold" onClick={() => onNavigate('app')}>← Go to Upload</button>
        </div>
      </div>
    );
  }

  const d = normalizedData.itr1;
  const report = buildItr1Report(normalizedData);
  const taxpayer = normalizedData.taxpayer;

  const handleDownload = async () => {
    await generateItr1Pdf(normalizedData);
  };

  const quickFacts = [
    { label: 'Total Income', value: compactINR(d.income.totalIncomeReported.value || report.income.grossTotalCalculated) },
    { label: 'Tax Liability', value: compactINR(d.taxComputed.grossTaxLiability.value) },
    { label: 'Taxes Paid', value: compactINR(d.taxesPaid.total.value) },
    { label: 'Refund / Payable', value: d.refundReported.value > 0 ? compactINR(d.refundReported.value) + ' refund' : compactINR(d.taxesPaid.balancePayable.value) + ' payable' }
  ];

  const regimeLabel = taxpayer.regime === 'new' ? 'New Regime' : 'Old Regime';

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
            <h2 className="section-title">Review Centre — ITR-1 (SAHAJ)</h2>
            <p className="section-sub">
              <span className="hero-badge" style={{ fontSize: '0.55rem', marginRight: 8 }}>
                <i className="fas fa-check-circle" style={{ fontSize: '0.4rem' }} /> {itrForm === 'ITR1' ? 'ITR-1 SAHAJ DETECTED' : itrForm}
              </span>
              {taxpayer.name} · PAN {taxpayer.pan} · AY {taxpayer.assessmentYear} · {regimeLabel}
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
                  <tr><td>Income from Salary</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.salary.value)}</td></tr>
                  <tr><td>Income from House Property</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.houseProperty.value)}</td></tr>
                  <tr><td>Income from Other Sources</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.otherSources.value)}</td></tr>
                  {d.ltcPresent && <tr><td>Capital Gains (112A)</td><td style={{ textAlign: 'right' }}>{formatINR(d.income.capitalGains.value)}</td></tr>}
                  <tr>
                    <td><strong>Gross Total Income</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatINR(report.income.grossTotalCalculated)}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Total Income</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{d.income.totalIncomeReported.value !== 0 ? formatINR(d.income.totalIncomeReported.value) : formatINR(report.income.grossTotalCalculated)}</strong></td>
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
                  <tr><td>Tax on income (normal rates)</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.taxOnIncomeNormal.value)}</td></tr>
                  {d.ltcPresent && <tr><td>Tax on LTCG 112A @12.5%</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.taxOnLtc112a.value)}</td></tr>}
                  <tr><td>Less: Rebate u/s 87A</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.rebate87A.value)}</td></tr>
                  <tr><td>Surcharge</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.surcharge.value)}</td></tr>
                  <tr><td>Health & Ed. cess (4%)</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.educationCess.value)}</td></tr>
                  <tr><td><strong>Total Tax</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(d.taxComputed.grossTaxLiability.value)}</strong></td></tr>
                  <tr><td>Add: Interest u/s 234A/B/C</td><td style={{ textAlign: 'right' }}>{formatINR(d.taxComputed.interest234.value)}</td></tr>
                  <tr><td><strong>Net Tax Payable</strong></td><td className="highlight" style={{ textAlign: 'right' }}><strong>{formatINR(d.taxComputed.netTaxPayable.value)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {report.deductions.length > 0 && taxpayer.regime === 'old' && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="card-title">Chapter VI-A Deductions ({regimeLabel})</h3>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  {report.deductions.map((d) => (
                    <tr key={d.code}><td>Deduction u/s {d.code}</td><td style={{ textAlign: 'right' }}>{formatINR(d.amount)}</td></tr>
                  ))}
                  <tr><td><strong>Total Deductions</strong></td><td style={{ textAlign: 'right' }}><strong>{formatINR(report.totalDeductions)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {d.exemptIncomeSection10.total > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="card-title">Section 10 Exempt Income</h3>
            <p className="card-sub">Exempt income reported under Section 10 — not chargeable to tax (included for rate purposes).</p>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="mini-table">
                <tbody>
                  {d.exemptIncomeSection10.details.map((e, i) => (
                    <tr key={i}>
                      <td>{e.label}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(e.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total Exempt Income (u/s 10)</strong></td>
                    <td style={{ textAlign: 'right' }} className="highlight"><strong>{formatINR(d.exemptIncomeSection10.total)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="card-title">Working Sections</h3>
          <p className="card-sub">Open any section of the ITR-1 working file.</p>
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