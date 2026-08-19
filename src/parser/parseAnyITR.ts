import type { ITRForm, NormalizedITR, ValidationIssue } from '../types';
import { parseItr4Object } from './itr4Parser';
import { parseItr1Object } from '../itr1/parser';
import { parseItr3Object } from '../itr3/parser';
import { detectITRForm } from '../itr/detectForm';

export interface ParsedAnyITR {
  normalized: NormalizedITR;
  issues: ValidationIssue[];
  form: ITRForm;
}

/**
 * Parse an ITR JSON export of any supported form (ITR-1 / ITR-3 / ITR-4).
 * Uses structural detection first, then falls back to trying each parser
 * (each self-validates and throws if the structure does not match).
 */
export function parseAnyITRObject(json: unknown): ParsedAnyITR {
  const detected = detectITRForm(json);
  if (detected === 'ITR1') return { ...parseItr1Object(json), form: 'ITR1' };
  if (detected === 'ITR3') return { ...parseItr3Object(json), form: 'ITR3' };
  if (detected === 'ITR4') return { ...parseItr4Object(json), form: 'ITR4' };
  try {
    return { ...parseItr1Object(json), form: 'ITR1' };
  } catch {
    try {
      return { ...parseItr3Object(json), form: 'ITR3' };
    } catch {
      return { ...parseItr4Object(json), form: 'ITR4' };
    }
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}