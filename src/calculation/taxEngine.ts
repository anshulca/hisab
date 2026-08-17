import type { DeductionItem, TaxComputation, TaxRegime } from '../types';
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
   Real ITR-4 (raw.ITR.ITR4) regime calculator - AY 2025-26 slabs
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

export function computeRealRegimeTax(income: number, regime: TaxRegime, deductionsTotal = 0): RealRegimeTaxResult {
  let tax = 0;
  let rebate = 0;
  let taxableIncome = income;

  if (regime === 'new') {
    // New Tax Regime (Section 115BAC) - no standard deduction for business income
    if (income <= 300000) tax = 0;
    else if (income <= 600000) tax = (income - 300000) * 0.05;
    else if (income <= 900000) tax = 15000 + (income - 600000) * 0.10;
    else if (income <= 1200000) tax = 45000 + (income - 900000) * 0.15;
    else if (income <= 1500000) tax = 90000 + (income - 1200000) * 0.20;
    else tax = 150000 + (income - 1500000) * 0.30;

    // Rebate 87A (New Regime, up to 7 lakhs)
    if (income <= 700000) {
      rebate = Math.min(tax, 25000);
      tax = tax - rebate;
    }
  } else {
    // Old Tax Regime - Chapter VI-A deductions allowed
    taxableIncome = Math.max(0, income - deductionsTotal);
    if (taxableIncome <= 250000) tax = 0;
    else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05;
    else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.20;
    else tax = 112500 + (taxableIncome - 1000000) * 0.30;

    // Rebate 87A (Old Regime, up to 5 lakhs)
    if (taxableIncome <= 500000) {
      rebate = Math.min(tax, 12500);
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