import type { NormalizedITR, ReportSection } from '../types';
import { parseNumber } from '../utils/currency';

const STOCK_SECTIONS: ReportSection[] = [
  {
    id: 'cover',
    title: 'Cover Page',
    summary: 'Cover page with taxpayer details and declaration.',
    details: []
  },
  {
    id: 'income',
    title: 'Income Computation',
    summary: 'Detailed income head-wise computation.',
    details: []
  },
  {
    id: 'expenses',
    title: 'Expense Summary',
    summary: 'Category-wise expenses claimed.',
    details: []
  },
  {
    id: 'depreciation',
    title: 'Depreciation Schedule',
    summary: 'Asset block-wise depreciation Working.',
    details: []
  },
  {
    id: 'pnl',
    title: 'Profit & Loss Working',
    summary: 'Reconstructed P&L from the computation.',
    details: []
  },
  {
    id: 'tax',
    title: 'Tax Computation',
    summary: 'Regime-wise tax computation with cess and prepaid taxes.',
    details: []
  },
  {
    id: 'final',
    title: 'Final Hisab Check',
    summary: 'Five-point reconciliation checklist.',
    details: []
  }
];

export function generateReport(normalized: NormalizedITR): ReportSection[] {
  if (!normalized) return [];

  const sections: ReportSection[] = [...STOCK_SECTIONS];

  const existingIds = new Set(normalized.reportSections.map((s) => s.id));
  for (const section of normalized.reportSections) {
    const target = sections.find((s) => s.id === section.id);
    if (target) {
      target.details = section.details;
      target.summary = section.summary;
    } else {
      sections.push(section);
    }
  }

  if (!existingIds.has('cover')) {
    pushCoverDetails(sections, normalized);
  }

  return sections;
}

function pushCoverDetails(sections: ReportSection[], n: NormalizedITR) {
  const cover = sections.find((s) => s.id === 'cover');
  if (!cover) return;
  cover.details = [
    { label: 'Taxpayer', value: n.taxpayer.name, highlight: true },
    { label: 'PAN', value: n.taxpayer.pan },
    { label: 'Assessment Year', value: n.taxpayer.assessmentYear },
    { label: 'Financial Year', value: n.taxpayer.financialYear },
    { label: 'Nature of Business', value: n.taxpayer.profession ?? n.taxpayer.type },
    { label: 'Return Type', value: 'ITR-4 (Presumptive / Sugam)' },
    { label: 'Computed At', value: n.computedAt }
  ];
}

export function getReportTotal(section: ReportSection): number {
  let total = 0;
  for (const detail of section.details) {
    const value = typeof detail.value === 'number' ? detail.value : parseNumber(detail.value);
    if (detail.highlight === undefined || detail.highlight) {
      total += value;
    }
  }
  return total;
}

export function serializeReportJson(normalized: NormalizedITR): string {
  return JSON.stringify(normalized, null, 2);
}