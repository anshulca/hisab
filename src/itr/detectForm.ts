import type { ITRForm } from '../types';

/**
 * Detect the ITR form from a parsed JSON export.
 * Uses the structure of the JSON itself — never the filename.
 *   { "ITR": { "ITR1": {...} } }  -> ITR1
 *   { "ITR": { "ITR2": {...} } }  -> ITR2
 *   { "ITR": { "ITR4": {...} } }  -> ITR4
 *   { "ITR": { "ITR3": {...} } }  -> ITR3
 * Key lookup is case-insensitive and also accepts the form object at the root.
 */
export function detectITRForm(json: unknown): ITRForm {
  if (!json || typeof json !== 'object') return 'UNKNOWN';
  const root = json as Record<string, unknown>;
  const itr = root.ITR as Record<string, unknown> | undefined;

  const pick = (candidate: unknown): ITRForm => {
    if (!candidate || typeof candidate !== 'object') return 'UNKNOWN';
    const c = candidate as Record<string, unknown>;
    for (const key of ['ITR1', 'itr1', 'ITR2', 'itr2', 'ITR4', 'itr4', 'ITR3', 'itr3']) {
      const v = c[key];
      if (v && typeof v === 'object') {
        const k = key.toLowerCase();
        if (k.includes('1')) return 'ITR1';
        if (k.includes('2')) return 'ITR2';
        if (k.includes('4')) return 'ITR4';
        if (k.includes('3')) return 'ITR3';
      }
    }
    return 'UNKNOWN';
  };

  const fromItr = pick(itr);
  if (fromItr !== 'UNKNOWN') return fromItr;
  return pick(root);
}

export function itrFormLabel(form: ITRForm): string {
  switch (form) {
    case 'ITR1':
      return 'ITR-1 (SAHAJ)';
    case 'ITR2':
      return 'ITR-2';
    case 'ITR4':
      return 'ITR-4 (SUGAM)';
    case 'ITR3':
      return 'ITR-3';
    default:
      return 'Unsupported ITR form';
  }
}