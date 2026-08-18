import { useState } from 'react';
import type { DepreciationAsset } from '../types';
import { formatINR } from '../utils/currency';

interface DepreciationScheduleEnhancedProps {
  initialAssets: DepreciationAsset[];
  onUpdate: (assets: DepreciationAsset[]) => void;
  assessmentYear?: string;
  onBack?: () => void;
}

const NEW_BLOCK_RATE = 0.15;

export function DepreciationScheduleEnhanced({ initialAssets, onUpdate, assessmentYear, onBack }: DepreciationScheduleEnhancedProps) {
  const [assets, setAssets] = useState<DepreciationAsset[]>(() => initialAssets.map((a) => ({ ...a })));
  const [dirty, setDirty] = useState(false);

  const recompute = (list: DepreciationAsset[]): DepreciationAsset[] =>
    list.map((asset) => {
      const closingWdv = asset.openingWdv + asset.additions - asset.sales;
      const depreciation = Math.round(Math.max(0, closingWdv) * asset.rate);
      return { ...asset, closingWdv: Math.max(0, closingWdv - depreciation), depreciation };
    });

  const updateField = (id: string, field: keyof DepreciationAsset, value: number) => {
    const next = assets.map((asset) => (asset.id === id ? { ...asset, [field]: Math.max(0, value) } : asset));
    const recomputed = recompute(next);
    setAssets(recomputed);
    setDirty(true);
  };

  const addBlock = () => {
    const newAsset: DepreciationAsset = {
      id: `asset-${Date.now()}`,
      blockName: 'New Block',
      rate: NEW_BLOCK_RATE,
      openingWdv: 0,
      additions: 0,
      sales: 0,
      closingWdv: 0,
      depreciation: 0,
      isNew: true
    };
    setAssets((prev) => [...prev, newAsset]);
    setDirty(true);
  };

  const removeBlock = (id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    setDirty(true);
  };

  const updateName = (id: string, name: string) => {
    setAssets((prev) => prev.map((asset) => (asset.id === id ? { ...asset, blockName: name } : asset)));
    setDirty(true);
  };

  const updateRate = (id: string, rate: number) => {
    const safeRate = Math.min(1, Math.max(0, rate));
    setAssets((prev) => recompute(prev.map((asset) => (asset.id === id ? { ...asset, rate: safeRate } : asset))));
    setDirty(true);
  };

  const save = () => {
    onUpdate(assets);
    setDirty(false);
  };

  const totalDepreciation = assets.reduce((sum, a) => sum + a.depreciation, 0);

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 1080 }}>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="section-title">Depreciation Schedule</h2>
            <p className="section-sub">
              Block-wise WDV method {assessmentYear ? `· AY ${assessmentYear}` : ''} · Income-tax Rules
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn-ghost" onClick={addBlock}>+ Add Block</button>
            <button className="btn-gold" onClick={save} disabled={!dirty}>Save Changes</button>
          </div>
        </div>

        {dirty && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--gold)', background: 'var(--gold-glow)' }}>
            <p style={{ fontSize: '0.9rem' }}>You have unsaved changes. Click <strong>Save Changes</strong> to update the computation.</p>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Rate</th>
                  <th>Opening WDV</th>
                  <th>Additions</th>
                  <th>Sales</th>
                  <th>Depreciation</th>
                  <th>Closing WDV</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <input
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 8px', width: 160 }}
                        value={asset.blockName}
                        onChange={(e) => updateName(asset.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        style={numStyle}
                        value={asset.rate * 100}
                        onChange={(e) => updateRate(asset.id, parseFloat(e.target.value) / 100 || 0)}
                      />%
                    </td>
                    <td><input type="number" style={numStyle} value={asset.openingWdv} onChange={(e) => updateField(asset.id, 'openingWdv', parseFloat(e.target.value) || 0)} /></td>
                    <td><input type="number" style={numStyle} value={asset.additions} onChange={(e) => updateField(asset.id, 'additions', parseFloat(e.target.value) || 0)} /></td>
                    <td><input type="number" style={numStyle} value={asset.sales} onChange={(e) => updateField(asset.id, 'sales', parseFloat(e.target.value) || 0)} /></td>
                    <td className="highlight">{formatINR(asset.depreciation)}</td>
                    <td>{formatINR(asset.closingWdv)}</td>
                    <td>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => removeBlock(asset.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--gold)' }}>
                  <td colSpan={5}><strong>Total Depreciation</strong></td>
                  <td className="highlight"><strong>{formatINR(totalDepreciation)}</strong></td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const numStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '6px 8px',
  width: 110
};