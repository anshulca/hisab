import type { DeductionItem, DepreciationAsset, ExpenseItem, IncomeSource, NormalizedITR, Taxpayer } from '../types';
import { parseExpenseItems } from '../calculation/expenseEngine';
import { computeTax, getStandardDeduction } from '../calculation/taxEngine';
import { getDefaultDepreciationBlocks } from '../calculation/depreciationEngine';
import { DEDUCTION_DEFINITIONS } from '../calculation/taxConfig';
import { validateSchema } from './schemaValidator';
import { parseRealItr4 } from './realItr4Parser';
import { getProfile } from '../config/businessProfiles';
import { parseNumber } from '../utils/currency';

export interface ParseResult {
  normalized: NormalizedITR;
  issues: ReturnType<typeof validateSchema>;
}

interface RawTaxpayer {
  name?: string;
  pan?: string;
  assessmentYear?: string;
  financialYear?: string;
  type?: string;
  regime?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  profession?: string;
}

interface RawBlock {
  blockName?: string;
  rate?: number;
  openingWdv?: number;
  additions?: number;
  sales?: number;
}

interface RawDepreciation {
  blocks?: RawBlock[];
  halfYearForNew?: boolean;
}

interface RawIncome {
  businessIncome?: {
    grossReceipts?: number;
    presumptive?: boolean;
    section?: string;
    rate?: number;
    computedIncome?: number;
  };
  capitalGains?: number;
  otherSources?: number;
  sources?: Array<{ code?: string; label?: string; amount?: number }>;
}

interface RawPrepaid {
  advanceTax?: number;
  tds?: number;
  selfAssessmentTax?: number;
}

interface RawItr {
  taxpayer?: RawTaxpayer;
  income?: RawIncome;
  expenses?: Array<Record<string, unknown>>;
  depreciation?: RawDepreciation;
  deductions?: Array<{ code?: string; amount?: number }>;
  prepaid?: RawPrepaid;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseItr4(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(raw).trim());
  } catch {
    throw new Error(
      'This file could not be read as JSON. Please upload the ITR export from the e-filing portal (expected structure: { "ITR": { "ITR4": { ... } } }).'
    );
  }
  return parseItr4Object(data);
}

export function parseItr4Object(data: unknown): ParseResult {
  const root = data as Record<string, unknown>;
  if (root?.ITR && (root.ITR as Record<string, unknown>)?.ITR4) {
    const { normalized, issues } = parseRealItr4(data);
    return { normalized, issues };
  }
  return buildNormalized(JSON.stringify(data));
}

function buildNormalized(raw: string): ParseResult {
  const data: RawItr = JSON.parse(raw);
  const issues = validateSchema(data);

  const rawTaxpayer = data.taxpayer ?? {};
  const taxpayerType = ['professional', 'other'].includes(String(rawTaxpayer.type)) ? String(rawTaxpayer.type) : 'business';
  const profile = getProfile(taxpayerType as Taxpayer['type']);

  const taxpayer: Taxpayer = {
    name: rawTaxpayer.name ?? 'Unknown Taxpayer',
    pan: (rawTaxpayer.pan ?? 'ABCDE1234F').toUpperCase(),
    assessmentYear: rawTaxpayer.assessmentYear ?? '2024-25',
    financialYear: rawTaxpayer.financialYear ?? '2023-24',
    type: taxpayerType as Taxpayer['type'],
    regime: rawTaxpayer.regime === 'old' ? 'old' : 'new',
    city: rawTaxpayer.city,
    state: rawTaxpayer.state,
    pinCode: rawTaxpayer.pinCode,
    profession: rawTaxpayer.profession ?? profile.label
  };

  const rawIncome = data.income ?? {};
  const businessBlock = rawIncome.businessIncome ?? {};
  const grossReceipts = parseNumber(businessBlock.grossReceipts);
  const presumptive = businessBlock.presumptive ?? true;
  const presumptiveRate = businessBlock.rate ?? profile.presumptiveRate;
  const computedBusinessIncome = presumptive ? Math.round(grossReceipts * presumptiveRate) : parseNumber(businessBlock.computedIncome);

  const capitalGains = parseNumber(rawIncome.capitalGains);
  const otherSources = parseNumber(rawIncome.otherSources);

  const sourceList: IncomeSource[] = Array.isArray(rawIncome.sources) && rawIncome.sources.length > 0
    ? rawIncome.sources.map((s, i) => ({
        code: s.code ?? `SRC${i + 1}`,
        label: s.label ?? 'Business Income',
        amount: parseNumber(s.amount)
      }))
    : [
        { code: 'PGBP', label: 'Profits & Gains of Business/Profession', amount: computedBusinessIncome },
        { code: 'CG', label: 'Capital Gains', amount: capitalGains },
        { code: 'OS', label: 'Income from Other Sources', amount: otherSources }
      ].filter((s) => s.amount !== 0);

  const totalIncome = sourceList.reduce((sum, s) => sum + s.amount, 0);
  sourceList.forEach((s) => { s.percentage = totalIncome > 0 ? (s.amount / totalIncome) * 100 : 0; });

  const expenseSummary = parseExpenseItems(data.expenses, profile.typicalExpenseCategories);

  const rawDep = data.depreciation ?? {};
  const depreciationBlocks: Array<{ blockName: string; rate: number; openingWdv: number; additions: number; sales: number }> = (
    Array.isArray(rawDep.blocks) && rawDep.blocks.length > 0
      ? rawDep.blocks
      : getDefaultDepreciationBlocks()
  ).map((b: RawBlock) => ({
    blockName: b.blockName ?? 'Plant & Machinery',
    rate: b.rate ?? 0.15,
    openingWdv: parseNumber(b.openingWdv),
    additions: parseNumber(b.additions),
    sales: parseNumber(b.sales)
  }));

  const depreciationAssets: DepreciationAsset[] = depreciationBlocks.map((b, index) => {
    const closingWdv = b.openingWdv + b.additions - b.sales;
    const effectiveRate = rawDep.halfYearForNew && b.additions > 0 ? b.rate / 2 : b.rate;
    const depreciation = Math.round(Math.max(0, closingWdv) * effectiveRate);
    return {
      id: `asset-${index + 1}`,
      blockName: b.blockName,
      rate: b.rate,
      openingWdv: b.openingWdv,
      additions: b.additions,
      sales: b.sales,
      closingWdv: Math.max(0, closingWdv - depreciation),
      depreciation
    };
  });

  const totalDepreciation = depreciationAssets.reduce((sum, a) => sum + a.depreciation, 0);

  const allDeductions: DeductionItem[] = Array.isArray(data.deductions)
    ? data.deductions.filter((d) => d.code && d.amount).map((d) => ({
        code: String(d.code),
        label: d.code === '80C' ? 'LIC, PF, PPF, ELSS, Tuition Fees' : String(d.code),
        amount: parseNumber(d.amount),
        section: String(d.code)
      }))
    : [];

  const deductions = allDeductions.filter((d) => {
    const definition = DEDUCTION_DEFINITIONS.find((x) => x.code === d.code);
    if (!definition) return taxpayer.regime === 'old';
    return definition.applicableRegime === taxpayer.regime;
  });

  const prepaid = data.prepaid ?? {};
  const advanceTax = parseNumber(prepaid.advanceTax);
  const tds = parseNumber(prepaid.tds);
  const selfAssessmentTax = parseNumber(prepaid.selfAssessmentTax);

  const taxComputation = computeTax({
    regime: taxpayer.regime,
    grossTotalIncome: totalIncome,
    deductions,
    standardDeduction: getStandardDeduction(taxpayer.regime),
    advanceTax,
    tds,
    selfAssessmentTax
  });

  const expenseItems: ExpenseItem[] = expenseSummary.items;
  const revenue = grossReceipts;
  const cogs = expenseItems.find((e) => e.category === 'Purchases')?.amount ?? 0;
  const otherExpenses = expenseItems.filter((e) => e.category !== 'Purchases');

  const incomeSources: IncomeSource[] = sourceList.map((s) => ({
    code: s.code,
    label: s.label,
    amount: s.amount,
    percentage: s.percentage
  }));

  const normalized: NormalizedITR = {
    taxpayer,
    incomeBreakdown: {
      businessIncome: computedBusinessIncome,
      capitalGains,
      otherSources,
      total: totalIncome,
      grossReceipts,
      sources: incomeSources
    },
    expenseSummary,
    depreciation: {
      totalDepreciation,
      assets: depreciationAssets
    },
    taxComputation,
    reportSections: [],
    computedAt: new Date().toISOString()
  };

  normalized.reportSections = buildReportSections(normalized, { revenue, cogs, otherExpenses });

  return { normalized, issues };
}

interface ReportSectionInput {
  revenue: number;
  cogs: number;
  otherExpenses: ExpenseItem[];
}

function buildReportSections(n: NormalizedITR, p: ReportSectionInput): NormalizedITR['reportSections'] {
  const income = n.incomeBreakdown;
  const tax = n.taxComputation;
  const grossProfit = p.revenue - p.cogs;
  const operatingExpenses = p.otherExpenses.reduce((s, e) => s + e.amount, 0);

  return [
    {
      id: 'income',
      title: 'Income Summary',
      summary: `Total gross total income of ₹${income.total.toLocaleString('en-IN')} for AY ${n.taxpayer.assessmentYear}.`,
      details: [
        { label: 'Business / Profession Income', value: income.businessIncome, highlight: true },
        { label: 'Capital Gains', value: income.capitalGains },
        { label: 'Other Sources', value: income.otherSources },
        { label: 'Gross Total Income', value: income.total, highlight: true }
      ]
    },
    {
      id: 'expenses',
      title: 'Expense Summary',
      summary: `Total expenses of ₹${n.expenseSummary.total.toLocaleString('en-IN')} claimed against business income.`,
      details: [
        { label: 'Total Expenses', value: n.expenseSummary.total, highlight: true },
        { label: 'Cost of Goods Sold (Purchases)', value: p.cogs },
        { label: 'Operating Expenses', value: operatingExpenses }
      ]
    },
    {
      id: 'depreciation',
      title: 'Depreciation Working',
      summary: `Depreciation of ₹${n.depreciation.totalDepreciation.toLocaleString('en-IN')} claimed on fixed assets.`,
      details: n.depreciation.assets.map((a) => ({
        label: a.blockName,
        value: a.depreciation
      }))
    },
    {
      id: 'tax',
      title: 'Tax Computation',
      summary: `Under ${n.taxpayer.regime === 'new' ? 'New' : 'Old'} regime, total tax payable is ₹${tax.netTaxPayable.toLocaleString('en-IN')}.`,
      details: [
        { label: 'Gross Total Income', value: tax.grossTotalIncome, highlight: true },
        { label: 'Deductions under Chapter VI-A', value: tax.totalDeductions },
        { label: 'Taxable Income', value: tax.taxableIncome, highlight: true },
        { label: 'Tax before Cess', value: tax.taxBeforeCess },
        { label: 'Surcharge', value: tax.surcharge },
        { label: 'Health & Education Cess (4%)', value: tax.healthCess },
        { label: 'Total Tax', value: tax.totalTax, highlight: true },
        { label: 'Less: Advance Tax', value: tax.advanceTax },
        { label: 'Less: TDS', value: tax.tds },
        { label: 'Net Tax Payable', value: tax.netTaxPayable, highlight: true },
        { label: 'Effective Tax Rate', value: `${tax.effectiveRate.toFixed(2)}%` }
      ]
    },
    {
      id: 'pnl',
      title: 'Profit & Loss Working',
      summary: `Gross profit ₹${grossProfit.toLocaleString('en-IN')} and net profit ${((n.incomeBreakdown.businessIncome / Math.max(1, p.revenue)) * 100).toFixed(1)}% of revenue.`,
      details: [
        { label: 'Revenue', value: p.revenue, highlight: true },
        { label: 'Less: COGS', value: p.cogs },
        { label: 'Gross Profit', value: grossProfit },
        { label: 'Less: Operating Expenses', value: operatingExpenses },
        { label: 'Less: Depreciation', value: n.depreciation.totalDepreciation },
        { label: 'Net Profit before Other Income', value: grossProfit - operatingExpenses - n.depreciation.totalDepreciation },
        { label: 'Net Profit', value: n.incomeBreakdown.businessIncome, highlight: true }
      ]
    }
  ];
}