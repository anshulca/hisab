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