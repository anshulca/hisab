import { useComputationStore } from '../store/computationStore';
import { generateItr3Pdf } from '../itr3/pdf';
import { buildItr3Report } from '../itr3/report';
import { formatINR } from '../utils/currency';

interface I3ReportViewerProps {
  onBack?: () => void;
}

export function I3ReportViewer({ onBack }: I3ReportViewerProps) {
  const normalizedData = useComputationStore((s) => s.normalizedData);

  if (!normalizedData?.itr3) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: 80 }}>
          <h2 className="section-title">No data yet</h2>
          <button className="btn-gold" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  const reportSections = normalizedData.reportSections;
  const report = buildItr3Report(normalizedData);

  const handleDownload = async () => {
    await generateItr3Pdf(normalizedData);
  };

  return (
    <div className="section">
      <div className="container">
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">ITR-3 Computation Report</h2>
            <p className="section-sub">
              {report.header.name} · PAN {report.header.pan} · AY {report.header.assessmentYear} · {report.header.regime}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn-gold" onClick={handleDownload}>⬇ Download PDF</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {reportSections.map((section) => (
            <div key={section.id} className="card">
              <h3 className="card-title">{section.title}</h3>
              {section.summary && <p className="card-sub">{section.summary}</p>}
              {section.details.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="mini-table">
                    <tbody>
                      {section.details.map((detail, index) => (
                        <tr key={index}>
                          <td>{detail.label}</td>
                          <td style={{ textAlign: 'right' }} className={detail.highlight ? 'highlight' : ''}>
                            {typeof detail.value === 'number' ? formatINR(detail.value) : detail.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No details for this section.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}