import type { ITRForm } from '../types';

/**
 * Detect the ITR form from a parsed JSON export.
 * Uses the structure of the JSON itself — never the filename.
 *   { "ITR": { "ITR1": {...} } }  -> ITR1
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
    for (const key of ['ITR1', 'itr1', 'ITR4', 'itr4', 'ITR3', 'itr3']) {
      const v = c[key];
      if (v && typeof v === 'object') {
        return key.toLowerCase().includes('4') ? 'ITR4' : key.toLowerCase().includes('3') ? 'ITR3' : 'ITR1';
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
    case 'ITR4':
      return 'ITR-4 (SUGAM)';
    case 'ITR3':
      return 'ITR-3';
    default:
      return 'Unsupported ITR form';
  }
}