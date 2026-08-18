import type { DeductionItem, TaxComputation, TaxRegime } from '../types';
import type { Slab } from './taxConfig';
import { CESS_RATE, STANDARD_DEDUCTION, STANDARD_DEDUCTION_NEW, getRebateConfig, getSlabs, getSurchargeRate } from './taxConfig';

export interface TaxEngineInput {
  regime: TaxRegime;
  grossTotalIncome: number;
  deductions: DeductionItem[];
  standardDeduction: number;
  advanceTax: number;
  tds: number;
  selfAssessmentTax: number;
}

export interface TaxEngineResult extends TaxComputation {
  applicableDeductions: DeductionItem[];
}

export function computeTax(input: TaxEngineInput): TaxEngineResult {
  const { regime, grossTotalIncome, deductions, standardDeduction, advanceTax, tds, selfAssessmentTax } = input;

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0) + standardDeduction;
  const taxableIncome = Math.max(0, grossTotalIncome - totalDeductions);

  const slabs = getSlabs(regime);
  let taxBeforeCess = 0;
  let remaining = taxableIncome;
  let previousLimit = 0;

  for (const slab of slabs) {
    const taxableInSlab = Math.min(Math.max(0, remaining), slab.upTo - previousLimit);
    taxBeforeCess += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    previousLimit = slab.upTo;
    if (remaining <= 0) break;
  }

  taxBeforeCess = Math.round(taxBeforeCess);

  const rebateConfig = getRebateConfig(regime);
  const rebate = taxableIncome <= (regime === 'new' ? 700000 : 500000) ? Math.min(taxBeforeCess, rebateConfig.amount) : 0;

  const taxAfterRebate = Math.max(0, taxBeforeCess - rebate);
  const surcharge = Math.round(taxAfterRebate * getSurchargeRate(taxableIncome));
  const healthCess = Math.round((taxAfterRebate + surcharge) * CESS_RATE);
  const totalTax = taxAfterRebate + surcharge + healthCess;

  const netTaxPayable = Math.max(0, totalTax - advanceTax - tds - selfAssessmentTax);

  const effectiveRate = grossTotalIncome > 0 ? (totalTax / grossTotalIncome) * 100 : 0;

  const applicableDeductions = deductions.filter((d) => d.amount > 0);

  return {
    regime,
    grossTotalIncome,
    deductions: applicableDeductions,
    totalDeductions,
    taxableIncome,
    taxBeforeCess,
    surcharge,
    healthCess,
    rebate,
    totalTax,
    advanceTax,
    tds,
    selfAssessmentTax,
    netTaxPayable,
    effectiveRate,
    applicableDeductions
  };
}

export function getStandardDeduction(regime: TaxRegime): number {
  return regime === 'new' ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION;
}

/* ==========================================================
   Real ITR-4 (raw.ITR.ITR4) regime calculator
   Auto-detects slab set from Assessment Year:
   - AY 2026-27 & later -> new 4/8/12/16/20/24L slabs (60k rebate)
   - AY 2025-26 & earlier -> 3/6/9/12/15L slabs (25k rebate)
   New Regime (115BAC) vs Old Regime, as per CA logic
   ========================================================== */
export interface RealRegimeTaxResult {
  income: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  tax: number;
  cess: number;
  rebate: number;
  totalPayable: number;
}

interface AYSlabSet {
  newRegime: Slab[];
  oldRegime: Slab[];
  newRebate: { threshold: number; amount: number };
  oldRebate: { threshold: number; amount: number };
}

const AY_2025_26_SLABS: AYSlabSet = {
  newRegime: [
    { upTo: 300000, rate: 0 },
    { upTo: 600000, rate: 0.05 },
    { upTo: 900000, rate: 0.1 },
    { upTo: 1200000, rate: 0.15 },
    { upTo: 1500000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 }
  ],
  oldRegime: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 }
  ],
  newRebate: { threshold: 700000, amount: 25000 },
  oldRebate: { threshold: 500000, amount: 12500 }
};

const AY_2026_27_SLABS: AYSlabSet = {
  newRegime: [
    { upTo: 400000, rate: 0 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.1 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.2 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: Infinity, rate: 0.3 }
  ],
  oldRegime: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 }
  ],
  newRebate: { threshold: 1200000, amount: 60000 },
  oldRebate: { threshold: 500000, amount: 12500 }
};

export function getAYSlabSet(assessmentYear: string): AYSlabSet {
  const startYear = parseInt(String(assessmentYear).split('-')[0] ?? '2025', 10) || 2025;
  return startYear >= 2026 ? AY_2026_27_SLABS : AY_2025_26_SLABS;
}

function taxForSlabs(income: number, slabs: Slab[]): number {
  let tax = 0;
  let previousLimit = 0;
  let remaining = income;
  for (const slab of slabs) {
    const taxableInSlab = Math.min(Math.max(0, remaining), slab.upTo - previousLimit);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    previousLimit = slab.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

export function computeRealRegimeTax(income: number, regime: TaxRegime, deductionsTotal = 0, assessmentYear = '2025-26'): RealRegimeTaxResult {
  const slabs = getAYSlabSet(assessmentYear);
  let tax = 0;
  let rebate = 0;
  let taxableIncome = income;

  if (regime === 'new') {
    // New Tax Regime (Section 115BAC) - no standard deduction for business income
    tax = taxForSlabs(income, slabs.newRegime);

    // Rebate 87A (New Regime)
    if (income <= slabs.newRebate.threshold) {
      rebate = Math.min(tax, slabs.newRebate.amount);
      tax = tax - rebate;
    }
  } else {
    // Old Tax Regime - Chapter VI-A deductions allowed
    taxableIncome = Math.max(0, income - deductionsTotal);
    tax = taxForSlabs(taxableIncome, slabs.oldRegime);

    // Rebate 87A (Old Regime, up to 5 lakhs)
    if (taxableIncome <= slabs.oldRebate.threshold) {
      rebate = Math.min(tax, slabs.oldRebate.amount);
      tax = tax - rebate;
    }
  }

  tax = Math.max(0, Math.round(tax));
  rebate = Math.round(rebate);
  const cess = Math.round(tax * 0.04);

  return {
    income,
    taxableIncome,
    taxBeforeRebate: tax + rebate,
    tax,
    cess,
    rebate,
    totalPayable: tax + cess
  };
}