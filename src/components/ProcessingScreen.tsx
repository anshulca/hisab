interface ProcessingScreenProps {
  progress: number;
  fileName?: string;
}

const STEPS = ['Parsing JSON', 'Validating schema', 'Computing income', 'Running tax engine', 'Generating report'];

export function ProcessingScreen({ progress, fileName }: ProcessingScreenProps) {
  const activeStep = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>⚙️</div>
      <h3 className="card-title">Processing your ITR</h3>
      <p className="card-sub">
        {fileName ? `Reading ${fileName}` : 'Reading file'} — {Math.round(progress)}%
      </p>

      <div style={{ textAlign: 'left', marginTop: 20 }}>
        {STEPS.map((step, index) => (
          <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                background: index < activeStep ? 'var(--gold)' : index === activeStep ? 'var(--gold-glow)' : 'var(--bg-secondary)',
                color: index <= activeStep ? '#0a0b12' : 'var(--text-muted)',
                border: '1px solid var(--border)'
              }}
            >
              {index < activeStep ? '✓' : index + 1}
            </span>
            <span style={{ color: index <= activeStep ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.9rem' }}>{step}</span>
          </div>
        ))}
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}