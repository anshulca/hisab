import type { ValidationIssue } from '../types';

export interface SchemaField {
  path: string;
  label: string;
  required?: boolean;
  type?: 'number' | 'string' | 'boolean' | 'array' | 'object';
}

const REQUIRED_FIELDS: SchemaField[] = [
  { path: 'taxpayer', label: 'Taxpayer details', required: true, type: 'object' },
  { path: 'taxpayer.name', label: 'Taxpayer name', required: true, type: 'string' },
  { path: 'taxpayer.pan', label: 'PAN', required: true, type: 'string' },
  { path: 'taxpayer.assessmentYear', label: 'Assessment Year', required: true, type: 'string' },
  { path: 'income', label: 'Income details', required: true, type: 'object' }
];

export function validateSchema(data: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (data === null || typeof data !== 'object') {
    return [{ path: 'root', message: 'Root of the file must be a JSON object.', severity: 'error' }];
  }

  const obj = data as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    const value = getByPath(obj, field.path);
    if (value === undefined || value === null || value === '') {
      if (field.required) {
        issues.push({ path: field.path, message: `Missing required field: ${field.label}`, severity: 'error' });
      }
    } else if (field.type === 'number' && typeof value !== 'number' && Number.isNaN(Number(value))) {
      issues.push({ path: field.path, message: `Field "${field.label}" should be numeric.`, severity: 'error' });
    }
  }

  const pan = getByPath(obj, 'taxpayer.pan');
  if (typeof pan === 'string' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase())) {
    issues.push({ path: 'taxpayer.pan', message: 'PAN format looks unusual. Expected: ABCDE1234F', severity: 'warning' });
  }

  const assessmentYear = getByPath(obj, 'taxpayer.assessmentYear');
  if (typeof assessmentYear === 'string' && !/^\d{4}-\d{2}$/.test(assessmentYear.trim())) {
    issues.push({ path: 'taxpayer.assessmentYear', message: 'Assessment Year format expected: YYYY-YY', severity: 'warning' });
  }

  const regime = getByPath(obj, 'taxpayer.regime');
  if (typeof regime === 'string' && !['new', 'old'].includes(regime)) {
    issues.push({ path: 'taxpayer.regime', message: 'Regime should be "new" or "old".', severity: 'warning' });
  }

  const gross = getByPath(obj, 'income.businessIncome.grossReceipts');
  if (typeof gross === 'number' && gross < 0) {
    issues.push({ path: 'income.businessIncome.grossReceipts', message: 'Gross receipts cannot be negative.', severity: 'error' });
  }

  const expenses = getByPath(obj, 'expenses');
  if (expenses !== undefined && !Array.isArray(expenses)) {
    issues.push({ path: 'expenses', message: '"expenses" should be an array.', severity: 'error' });
  }

  const deductions = getByPath(obj, 'deductions');
  if (deductions !== undefined && !Array.isArray(deductions)) {
    issues.push({ path: 'deductions', message: '"deductions" should be an array.', severity: 'error' });
  }

  const blocks = getByPath(obj, 'depreciation.blocks');
  if (blocks !== undefined && !Array.isArray(blocks)) {
    issues.push({ path: 'depreciation.blocks', message: '"depreciation.blocks" should be an array.', severity: 'error' });
  }

  const totalExpenses = getByPath(obj, 'totals.totalExpenses');
  if (typeof totalExpenses === 'number' && totalExpenses < 0) {
    issues.push({ path: 'totals.totalExpenses', message: 'Total expenses cannot be negative.', severity: 'error' });
  }

  return issues;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}