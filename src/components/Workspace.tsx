import { useComputationStore } from '../store/computationStore';
import { UploadCard } from './UploadCard';
import { ReviewCentre } from './ReviewCentre';
import { I1ReviewCentre } from './I1ReviewCentre';

interface WorkspaceProps {
  onNavigate: (section: string) => void;
}

export function Workspace({ onNavigate }: WorkspaceProps) {
  const isReady = useComputationStore((s) => s.normalizedData !== null);
  const itrForm = useComputationStore((s) => s.itrForm);

  if (isReady) {
    return itrForm === 'ITR1' ? <I1ReviewCentre onNavigate={onNavigate} /> : <ReviewCentre onNavigate={onNavigate} />;
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div style={{ textAlign: 'center', margin: '56px auto 0' }}>
          <span className="hero-badge" style={{ margin: '0 auto' }}>
            <i className="fas fa-upload" style={{ fontSize: '0.4rem' }} /> GET STARTED
          </span>
          <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.6rem)', fontWeight: 600, marginTop: 10, color: 'var(--text)' }}>
            Upload your <span style={{ color: 'var(--gold)' }}>ITR JSON</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            JSON se Computation tak - in one click. ITR-1 (SAHAJ) and ITR-4 (SUGAM) auto-detected.
          </p>
        </div>
        <div style={{ maxWidth: 700, margin: '34px auto 70px' }}>
          <UploadCard onGenerated={() => onNavigate('review')} />
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="btn-ghost" onClick={() => onNavigate('compare')} style={{ width: '100%' }}>
              <i className="fas fa-balance-scale" style={{ marginRight: 8, color: 'var(--gold)' }} />
              Compare 2 Years (Prev + Curr JSONs) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}