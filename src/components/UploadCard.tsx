import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileUpload } from '../hooks/useFileUpload';
import { ProcessingScreen } from './ProcessingScreen';
import { useComputationStore } from '../store/computationStore';

interface UploadCardProps {
  onGenerated: () => void;
}

export function UploadCard({ onGenerated }: UploadCardProps) {
  const { isProcessing, progress, processFile } = useFileUpload();
  const upload = useComputationStore((state) => state.upload);
  const prevData = useComputationStore((state) => state.prevData);
  const processPrevRawText = useComputationStore((state) => state.processPrevRawText);
  const setUpload = useComputationStore((state) => state.setUpload);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      void processFile(file).then((result) => {
        if (result.ok) onGenerated();
      });
    },
    [processFile, onGenerated]
  );

  const onPrevDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.json')) {
        setUpload({ status: 'error', error: 'Only .json files are supported (ITR export format).' });
        return;
      }
      void file.text().then((text) => {
        const result = processPrevRawText(text, file.name);
        if (!result.ok) {
          setUpload({ status: 'error', error: result.error ?? 'Previous year file could not be parsed.' });
        }
      });
    },
    [processPrevRawText, setUpload]
  );

  const prevDrop = useDropzone({
    onDrop: onPrevDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1
  });

  if (isProcessing) {
    return <ProcessingScreen progress={progress} fileName={upload.fileName} />;
  }

  return (
    <div>
      <div>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <div className="dropzone-icon">📄</div>
          <h3 style={{ marginBottom: 8, fontSize: '1.1rem' }}>Drop your CURRENT year ITR JSON here</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Drag & drop or <strong style={{ color: 'var(--gold)' }}>browse</strong> - max 5MB
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
            Supported: ITR-1 (SAHAJ), ITR-2, ITR-3 & ITR-4 (SUGAM) exports (.json) · test files in <code>test-data/</code>
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <div {...prevDrop.getRootProps()} className={`dropzone ${prevDrop.isDragActive ? 'active' : ''}`} style={{ padding: '18px 24px' }}>
            <input {...prevDrop.getInputProps()} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ marginBottom: 4, fontSize: '0.95rem' }}>
                  <span className="hero-badge" style={{ fontSize: '0.55rem', marginBottom: 8 }}>
                    <i className="fas fa-clipboard-list" style={{ fontSize: '0.4rem' }} /> OPTIONAL
                  </span>{' '}
                  Previous Year ITR JSON
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Add last year's file to enable Previous vs Current comparison + capital continuity
                </p>
                {prevData && (
                  <p style={{ color: 'var(--gold)', fontSize: '0.82rem', marginTop: 6 }}>
                    <i className="fas fa-check-circle" style={{ marginRight: 6 }} />
                    {prevData.taxpayer.name} · AY {prevData.taxpayer.assessmentYear} · Turnover{' '}
                    {prevData.incomeBreakdown.grossReceipts.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              <span style={{ color: varTextMuted(), fontSize: '0.8rem' }}>
                {prevData ? '✓ Loaded - click to replace' : 'click to browse'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {upload.status === 'error' && (
        <div className="card" style={{ marginTop: 16, borderColor: 'rgba(220,80,80,0.4)', background: 'rgba(220,80,80,0.06)' }}>
          <p style={{ color: 'var(--text)' }}>⚠️ {upload.error}</p>
        </div>
      )}
    </div>
  );
}

function varTextMuted(): string {
  return 'var(--text-muted)';
}