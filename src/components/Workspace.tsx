import { useComputationStore } from '../store/computationStore';
import { UploadCard } from './UploadCard';
import { ReviewCentre } from './ReviewCentre';

interface WorkspaceProps {
  onNavigate: (section: string) => void;
}

export function Workspace({ onNavigate }: WorkspaceProps) {
  const isReady = useComputationStore((s) => s.normalizedData !== null);

  if (isReady) {
    return <ReviewCentre onNavigate={onNavigate} />;
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div style={{ textAlign: 'center', margin: '56px auto 0' }}>
          <span className="hero-badge" style={{ margin: '0 auto' }}>
            <i className="fas fa-upload" style={{ fontSize: '0.4rem' }} /> GET STARTED
          </span>
          <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.6rem)', fontWeight: 600, marginTop: 10, color: 'var(--text)' }}>
            Upload your <span style={{ color: 'var(--gold)' }}>ITR-4 JSON</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            JSON se Computation tak - in one click.
          </p>
        </div>
        <div style={{ maxWidth: 700, margin: '34px auto 70px' }}>
          <UploadCard onGenerated={() => onNavigate('review')} />
        </div>
      </div>
    </div>
  );
}