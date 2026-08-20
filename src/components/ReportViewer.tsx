import { useComputation } from '../hooks/useComputation';
import { useGuardedDownload } from '../hooks/useGuardedDownload';
import { generatePdf } from '../pdf/pdfGenerator';
import { renderReportHtml } from '../reports/reportRenderer';
import { formatINR } from '../utils/currency';
import type { ReportSection } from '../types';

interface ReportViewerProps {
  sections?: ReportSection[];
  onBack?: () => void;
}

export function ReportViewer({ sections, onBack }: ReportViewerProps) {
  const { normalizedData } = useComputation();

  const reportSections = sections ?? normalizedData?.reportSections ?? [];

  const handleDownloadAsync = async () => {
    if (normalizedData) await generatePdf(normalizedData);
  };
  const handleDownload = useGuardedDownload(handleDownloadAsync);

  const handleDownloadHtml = () => {
    if (!normalizedData) return;
    const html = renderReportHtml(normalizedData);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HISAB_${normalizedData.taxpayer.pan}_${normalizedData.taxpayer.assessmentYear.replace('-', '_')}_report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section">
      <div className="container">
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Computation Report</h2>
            <p className="section-sub">Complete working file of the ITR computation.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn-ghost" onClick={handleDownloadHtml} disabled={!normalizedData}>
              ⬇ Download HTML
            </button>
            <button className="btn-gold" onClick={handleDownload} disabled={!normalizedData}>
              ⬇ Download PDF
            </button>
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