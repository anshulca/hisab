import type { ITRForm } from '../types';

/**
 * Detect the ITR form from a parsed JSON export.
 * Uses ONLY the structure of the JSON itself — never the filename.
 *   { "ITR": { "ITR1": {...} } }  -> ITR1
 *   { "ITR": { "ITR4": {...} } }  -> ITR4
 *   { "ITR": { "ITR3": {...} } }  -> ITR3
 *   anything else                 -> UNKNOWN
 */
export function detectITRForm(json: unknown): ITRForm {
  if (!json || typeof json !== 'object') return 'UNKNOWN';
  const root = json as Record<string, unknown>;
  const itr = root.ITR as Record<string, unknown> | undefined;
  if (!itr || typeof itr !== 'object') return 'UNKNOWN';

  if (itr.ITR1 && typeof itr.ITR1 === 'object') return 'ITR1';
  if (itr.ITR4 && typeof itr.ITR4 === 'object') return 'ITR4';
  if (itr.ITR3 && typeof itr.ITR3 === 'object') return 'ITR3';
  return 'UNKNOWN';
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