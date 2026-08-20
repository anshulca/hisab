import { useState } from 'react';
import { useUsageStore, FREE_REPORT_LIMIT, adminTokenHashOf } from '../access/usageStore';

interface UsageLimitModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown when the free download limit is reached. Admins unlock by entering the
 * secret token; the token is verified by digest (only its hash is compared).
 */
export function UsageLimitModal({ open, onClose }: UsageLimitModalProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const unlockAdmin = useUsageStore((s) => s.unlockAdmin);

  if (!open) return null;

  const submit = async () => {
    setChecking(true);
    setError('');
    try {
      const expected = 'B1E3331B3DC607BEEFE33B06B283EE6B19F6E3847FF7C316C448B6F7827095B1';
      const digest = await adminTokenHashOf(token);
      if (digest === expected) {
        unlockAdmin();
        setToken('');
        onClose();
      } else {
        setError('That unlock token is not recognised.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Free limit reached</h3>
        <p className="card-sub" style={{ marginTop: 10 }}>
          Each device can download {FREE_REPORT_LIMIT} free HISAB PDF reports. To generate unlimited
          reports, enter your admin unlock token below.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Admin unlock token"
          autoFocus
        />
        {error && (
          <p style={{ color: 'var(--danger, #b91c1c)', fontSize: 13, marginTop: 6 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-gold" onClick={submit} disabled={checking || !token.trim()}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}