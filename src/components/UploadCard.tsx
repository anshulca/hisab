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
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <div className="dropzone-icon">📄</div>
        <h3 style={{ marginBottom: 8, fontSize: '1.1rem' }}>Drop your ITR JSON here</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Drag & drop or <strong style={{ color: 'var(--gold)' }}>browse</strong> - max 5MB
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
          Supported: ITR-4 export (.json) · test files included in <code>test-data/</code>
        </p>
      </div>

      {upload.status === 'error' && (
        <div className="card" style={{ marginTop: 16, borderColor: 'rgba(220,80,80,0.4)', background: 'rgba(220,80,80,0.06)' }}>
          <p style={{ color: 'var(--text)' }}>⚠️ {upload.error}</p>
        </div>
      )}
    </div>
  );
}