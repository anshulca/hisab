import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { NormalizedITR, ValidationIssue } from '../types';
import { parseItr4Object } from '../parser/itr4Parser';
import { compareYears, type CompareResult } from '../calculation/comparisonEngine';
import { formatINR } from '../utils/currency';
import { generateComparePdf } from '../pdf/pdfGenerator';

interface CompareWorkspaceProps {
  onNavigate: (section: string) => void;
}

interface LoadedFile {
  fileName: string;
  normalized: NormalizedITR;
  issues: ValidationIssue[];
}

type SlotKey = 'prev' | 'curr';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function CompareWorkspace({ onNavigate }: CompareWorkspaceProps) {
  const [prev, setPrev] = useState<LoadedFile | null>(null);
  const [curr, setCurr] = useState<LoadedFile | null>(null);
  const [prevError, setPrevError] = useState<string | null>(null);
  const [currError, setCurrError] = useState<string | null>(null);
  const [report, setReport] = useState<CompareResult | null>(null);

  const readFile = useCallback(async (file: File, slot: SlotKey): Promise<void> => {
    try {
      const text = await file.text();
      const data = JSON.parse(stripBom(text).trim());
      const { normalized, issues } = parseItr4Object(data);
      const loaded: LoadedFile = { fileName: file.name, normalized, issues };
      if (slot === 'prev') { setPrev(loaded); setPrevError(null); }
      else { setCurr(loaded); setCurrError(null); }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read this file as an ITR-4 JSON.';
      if (slot === 'prev') { setPrev(null); setPrevError(message); }
      else { setCurr(null); setCurrError(message); }
    }
  }, []);

  const prevDrop = useDropzone({
    onDrop: (files: File[]) => { void readFile(files[0], 'prev'); },
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    multiple: false
  });

  const currDrop = useDropzone({
    onDrop: (files: File[]) => { void readFile(files[0], 'curr'); },
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    multiple: false
  });

  const canGenerate = Boolean(curr);
  const handleGenerate = () => {
    if (!curr) return;
    setReport(compareYears(prev?.normalized ?? null, curr.normalized));
  };

  const slotUi = (slot: SlotKey, label: string, hint: string, file: LoadedFile | null, error: string | null) => {
    const dz = slot === 'prev' ? prevDrop : currDrop;
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div {...dz.getRootProps()} className={`dropzone ${dz.isDragActive ? 'active' : ''}`} style={{ background: 'transparent', border: 'none' }}>
          <input {...dz.getInputProps()} />
          <div className="dropzone-icon">{slot === 'prev' ? '📁' : '📄'}</div>
          <h3 style={{ marginBottom: 6, fontSize: '1rem' }}>{label}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>{hint}</p>
          {file && (
            <p style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>
              <i className="fas fa-check-circle" style={{ marginRight: 6 }} />
              {file.fileName} · AY {file.normalized.taxpayer.assessmentYear}
            </p>
          )}
          {error && !file && <p style={{ color: 'rgba(220,80,80,0.9)', fontSize: '0.8rem' }}>⚠ {error}</p>}
        </div>
      </div>
    );
  };

  const highlight = (value: number | string | null) => {
    if (value === null) return { color: 'var(--text-muted)' };
    if (typeof value !== 'number') return {};
    if (value > 0) return { color: '#34d399' };
    if (value < 0) return { color: '#f87171' };
    return {};
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <div style={{ textAlign: 'center', margin: '48px auto 0' }}>
          <span className="hero-badge" style={{ margin: '0 auto' }}>
            <i className="fas fa-balance-scale" style={{ fontSize: '0.4rem' }} /> COMPARE YEARS
          </span>
          <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 600, marginTop: 10, color: 'var(--text)' }}>
            Upload <span style={{ color: 'var(--gold)' }}>2 JSONs</span> - Previous & Current
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            Previous year is optional (used for growth % and capital continuity). Current year is required.
          </p>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 30 }}>
          {slotUi('prev', 'Previous Year (optional)', 'AY 2025-26 or earlier', prev, prevError)}
          {slotUi('curr', 'Current Year (required)', 'AY 2026-27 or latest', curr, currError)}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn-gold" disabled={!canGenerate} onClick={handleGenerate} style={canGenerate ? {} : { opacity: 0.45, cursor: 'not-allowed' }}>
            Generate Comparison <i className="fas fa-arrow-right" />
          </button>
          {report && (
            <button className="btn-ghost" onClick={async () => { if (report) await generateComparePdf(report); }}>⬇ Download PDF</button>
          )}
          <button className="btn-ghost" onClick={() => onNavigate('app')}>← Single File Mode</button>
        </div>

        {!canGenerate && (
          <div className="card" style={{ marginTop: 24, textAlign: 'center', borderColor: 'rgba(212,168,84,0.3)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload the current year ITR-4 JSON to start.</p>
          </div>
        )}

        {report && (
          <div style={{ marginTop: 36 }}>
            <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 className="section-title">Year-on-Year Comparison</h2>
                <p className="section-sub">
                  {report.curr.taxpayer.name} · PAN {report.curr.taxpayer.pan} ·{' '}
                  {report.prev ? `AY ${report.prev.taxpayer.assessmentYear} → ` : ''}AY {report.curr.taxpayer.assessmentYear}
                </p>
              </div>
            </div>

            {report.alerts.length > 0 && (
              <div className="card" style={{ marginTop: 16, borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.05)' }}>
                <h3 className="card-title" style={{ color: 'var(--gold)' }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} /> Reconciliation Alerts
                </h3>
                {report.alerts.map((a, i) => (
                  <p key={i} className="card-sub" style={{ marginTop: i === 0 ? 6 : 2 }}>{a}</p>
                ))}
              </div>
            )}

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 20 }}> {
              (() => {
                const t = report.curr.incomeBreakdown.total;
                const growRow = report.rows.find((r) => r.label === 'Gross Total Income');
                const taxRow = report.rows.find((r) => r.label === 'Net Tax Payable');
                return [
                  { label: 'Total Income (Curr)', value: formatINR(t) },
                  { label: 'Income Growth', value: growRow?.growth != null ? `${growRow.growth >= 0 ? '+' : ''}${growRow.growth.toFixed(1)}%` : '—' },
                  { label: 'Net Tax (Curr)', value: formatINR(taxRow?.curr as number ?? 0) }
                ].map((f) => (
                  <div key={f.label} className="stat-card">
                    <div className="stat-label">{f.label}</div>
                    <div className="stat-value gold">{f.value}</div>
                  </div>
                ));
              })()
            } </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">Comparison Table</h3>
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--gold)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Metric</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{report.prev ? `Prev · AY ${report.prev.taxpayer.assessmentYear}` : 'Previous'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Curr · AY {report.curr.taxpayer.assessmentYear}</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.label}>
                        <td style={{ padding: '8px 10px' }}>{row.label}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {row.prev === null ? '—' : row.kind === 'money' ? formatINR(row.prev as number) : row.kind === 'percent' ? `${(row.prev as number).toFixed(2)}%` : row.prev}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {row.kind === 'money' ? formatINR(row.curr as number) : row.kind === 'percent' ? `${(row.curr as number).toFixed(2)}%` : row.curr}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', ...highlight(row.growth ?? null) }}>
                          {row.growth == null ? '—' : `${row.growth >= 0 ? '▲' : '▼'} ${Math.abs(row.growth).toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.capital && (
              <div className="card" style={{ marginTop: 20, borderColor: 'rgba(212,168,84,0.35)' }}>
                <h3 className="card-title">
                  <i className="fas fa-balance-scale" style={{ marginRight: 8, color: 'var(--gold)' }} />
                  Capital Account Continuity {report.capital.reconciles ? <span style={{ color: '#34d399', fontSize: '0.8rem' }}>· Balanced ✓</span> : <span style={{ color: '#f87171', fontSize: '0.8rem' }}>· Check needed</span>}
                </h3>
                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table className="mini-table">
                    <tbody>
                      <tr><td>Opening Capital</td><td style={{ textAlign: 'right' }}>{formatINR(report.capital.openingCapital)}</td></tr>
                      <tr><td>Add: Net Profit</td><td style={{ textAlign: 'right' }}>{formatINR(report.capital.netProfit)}</td></tr>
                      <tr><td>Add: Capital Introduced</td><td style={{ textAlign: 'right' }}>{formatINR(report.capital.capitalIntroduced)}</td></tr>
                      <tr><td>Less: Drawings</td><td style={{ textAlign: 'right' }}>{formatINR(report.capital.drawings)}</td></tr>
                      <tr>
                        <td><strong>Closing Capital</strong></td>
                        <td style={{ textAlign: 'right' }}><strong>{formatINR(report.capital.closingCapital)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">Working Mode</h3>
              <p className="card-sub">For a full single-file computation (P&L, depreciation, Hisab check), switch back to single file mode.</p>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 14 }}>
                <button className="btn-ghost" onClick={() => onNavigate('app')} style={{ textAlign: 'center' }}>Upload Single ITR →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}