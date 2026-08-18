import type { NormalizedITR } from '../types';

export interface CompareRow {
  label: string;
  prev: number | string | null;
  curr: number | string | null;
  kind: 'money' | 'percent' | 'text';
  growth?: number | null;
}

export interface CapitalContinuity {
  openingCapital: number;
  netProfit: number;
  capitalIntroduced: number;
  drawings: number;
  closingCapital: number;
  reconciles: boolean;
}

export interface CompareResult {
  prev: NormalizedITR | null;
  curr: NormalizedITR;
  rows: CompareRow[];
  capital?: CapitalContinuity;
  alerts: string[];
}

export function getAYStart(ay: string): number {
  const n = parseInt(String(ay).split('-')[0] ?? '2025', 10);
  return Number.isFinite(n) ? n : 2025;
}

function sectionValue(n: NormalizedITR, sectionId: string, label: string): number {
  const section = n.reportSections.find((s) => s.id === sectionId);
  const detail = section?.details.find((d) => d.label === label);
  return typeof detail?.value === 'number' ? detail.value : 0;
}

function balanceSheetValue(n: NormalizedITR, label: string): number {
  return sectionValue(n, 'balancesheet', label);
}

function growthOf(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function compareYears(prev: NormalizedITR | null, curr: NormalizedITR): CompareResult {
  const rows: CompareRow[] = [];
  const alerts: string[] = [];

  const p = prev?.incomeBreakdown;
  const c = curr.incomeBreakdown;
  const pt = prev?.taxComputation;
  const ct = curr.taxComputation;

  const moneyRow = (label: string, pv: number | null | undefined, cv: number | undefined): CompareRow => ({
    label,
    prev: pv ?? null,
    curr: cv ?? 0,
    kind: 'money',
    growth: pv != null ? growthOf(pv, cv ?? 0) : null
  });

  rows.push(moneyRow('Gross Turnover (E1)', p?.grossReceipts, c.grossReceipts));
  rows.push(moneyRow('Business / Professional Income (E2)', p?.businessIncome, c.businessIncome));
  rows.push(moneyRow('Capital Gains (112A)', p?.capitalGains, c.capitalGains));
  rows.push(moneyRow('Income from Other Sources', p?.otherSources, c.otherSources));
  rows.push(moneyRow('Gross Total Income', p?.total, c.total));
  rows.push(moneyRow('Taxable Income', pt?.taxableIncome, ct?.taxableIncome));
  rows.push(moneyRow('Total Tax', pt?.totalTax, ct?.totalTax));
  rows.push(moneyRow('Advance Tax', pt?.advanceTax, ct?.advanceTax));
  rows.push(moneyRow('TDS', pt?.tds, ct?.tds));
  rows.push(moneyRow('Net Tax Payable', pt?.netTaxPayable, ct?.netTaxPayable));

  const prevMargin = p && p.grossReceipts > 0 ? (p.businessIncome / p.grossReceipts) * 100 : 0;
  const currMargin = c.grossReceipts > 0 ? (c.businessIncome / c.grossReceipts) * 100 : 0;
  rows.push({
    label: 'Net Profit %',
    prev: prevMargin,
    curr: currMargin,
    kind: 'percent',
    growth: null
  });

  rows.push({ label: 'Assessment Year', prev: prev?.taxpayer.assessmentYear ?? null, curr: curr.taxpayer.assessmentYear, kind: 'text' });
  rows.push({ label: 'Tax Regime', prev: prev?.taxpayer.regime === 'new' ? 'New' : 'Old', curr: curr.taxpayer.regime === 'new' ? 'New' : 'Old', kind: 'text' });

  const prevTurnover = p?.grossReceipts ?? 0;
  const turnGrowth = growthOf(prevTurnover, c.grossReceipts);
  if (prevTurnover > 0 && turnGrowth != null && Math.abs(turnGrowth) > 40) {
    alerts.push(
      `Turnover changed by ${Math.abs(turnGrowth).toFixed(0)}% versus previous year (${turnGrowth > 0 ? 'up' : 'down'}). Large swings may trigger a 44AD eligibility or scrutiny review.`
    );
  }

  if (prev && curr && prev.taxpayer.regime !== curr.taxpayer.regime) {
    alerts.push('Tax regime changed versus previous year - verify the 10-IEA opt-out status before finalising.');
  }

  if (prev && prev.taxpayer.profession !== curr.taxpayer.profession) {
    alerts.push(`Business method changed from "${prev.taxpayer.profession}" to "${curr.taxpayer.profession}".`);
  }

  const prevAstYear = getAYStart(prev?.taxpayer.assessmentYear ?? '');
  const currAstYear = getAYStart(curr.taxpayer.assessmentYear ?? '');
  if (prev && curr && prevAstYear && currAstYear && currAstYear - prevAstYear !== 1) {
    alerts.push(`Use continuous assessment years. Detected ${prev?.taxpayer.assessmentYear} and ${curr.taxpayer.assessmentYear}.`);
  }

  let capital: CapitalContinuity | undefined;
  const pClosingCap = prev ? balanceSheetValue(prev, 'Capital & Liabilities') : 0;
  const cClosingCap = balanceSheetValue(curr, 'Capital & Liabilities');
  const cProfit = c.businessIncome;
  const pTotalAssets = prev ? balanceSheetValue(prev, 'Total Assets') : 0;
  const cTotalAssets = balanceSheetValue(curr, 'Total Assets');
  const pCapKnown = prev ? pClosingCap > 0 : false;

  if (cClosingCap > 0 || cTotalAssets > 0) {
    const opening = prev ? pClosingCap : cClosingCap;
    const diff = opening + cProfit - cClosingCap;
    const reconciledBySheets = cTotalAssets > 0 && Math.abs(cTotalAssets - cClosingCap) < Math.max(1, cTotalAssets * 0.005);
    capital = {
      openingCapital: opening,
      netProfit: cProfit,
      capitalIntroduced: Math.max(0, -diff),
      drawings: Math.max(0, diff),
      closingCapital: cClosingCap,
      reconciles: reconciledBySheets
    };
    if (reconciledBySheets && opening > 0 && diff < 0) {
      alerts.push('Capital introduced during the year exceeds declared profit - verify source of funds.');
    }
    if (!reconciledBySheets && pCapKnown) {
      alerts.push(`Balance sheet does not reconcile: Capital & Liabilities ₹${cClosingCap.toLocaleString('en-IN')} vs Total Assets ₹${cTotalAssets.toLocaleString('en-IN')}.`);
    }
    if (opening <= 0 && pTotalAssets > 0 && pClosingCap <= 0) {
      alerts.push('Previous year closing capital was not found - capital continuity shown for reference only.');
    }
  }

  const prevTax = pt?.netTaxPayable ?? 0;
  const currTax = ct?.netTaxPayable ?? 0;
  if (prev && curr && prevTax === 0 && currTax > 0) {
    alerts.push('Tax payable moved from ₹0 to a positive amount this year - confirm advance tax instalments were sized correctly.');
  }

  return { prev, curr, rows, capital, alerts };
}