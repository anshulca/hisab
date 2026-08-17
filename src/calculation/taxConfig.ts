import type { TaxRegime } from '../types';

export interface Slab {
  upTo: number;
  rate: number;
}

export interface RebateConfig {
  enabled: boolean;
  amount: number;
}

export const ASSESSMENT_YEAR = '2024-25';
export const FINANCIAL_YEAR = '2023-24';

export const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 300000, rate: 0 },
  { upTo: 600000, rate: 0.05 },
  { upTo: 900000, rate: 0.1 },
  { upTo: 1200000, rate: 0.15 },
  { upTo: 1500000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 }
];

export const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 }
];

export const REBATE_87A: RebateConfig = {
  enabled: true,
  amount: 25000
};

export const REBATE_87A_NEW_REGIME: RebateConfig = {
  enabled: true,
  amount: 25000
};

export const CESS_RATE = 0.04;

export interface SurchargeSlab {
  incomeAbove: number;
  rate: number;
}

export const SURCHARGE_SLABS: SurchargeSlab[] = [
  { incomeAbove: 5000000, rate: 0.1 },
  { incomeAbove: 10000000, rate: 0.15 },
  { incomeAbove: 20000000, rate: 0.25 },
  { incomeAbove: 50000000, rate: 0.37 }
];

export const NEW_REGIME_DEDUCTIONS: string[] = ['80CCD2'];
export const OLD_REGIME_DEDUCTION_SECTIONS: string[] = ['80C', '80CCD1B', '80D', '80E', '80G', '80TTA', '80TTB', '80CCC', '80CCD1', '80DD', '80DDB'];

export const STANDARD_DEDUCTION = 50000;
export const STANDARD_DEDUCTION_NEW = 50000;

export interface DeductionDefinition {
  code: string;
  label: string;
  section: string;
  maxAmount: number;
  applicableRegime: TaxRegime;
}

export const DEDUCTION_DEFINITIONS: DeductionDefinition[] = [
  { code: '80C', label: 'LIC, PF, PPF, ELSS, Tuition Fees', section: '80C', maxAmount: 150000, applicableRegime: 'old' },
  { code: '80CCD1B', label: 'NPS (Additional)', section: '80CCD(1B)', maxAmount: 50000, applicableRegime: 'old' },
  { code: '80D', label: 'Medical Insurance Premium', section: '80D', maxAmount: 25000, applicableRegime: 'old' },
  { code: '80E', label: 'Education Loan Interest', section: '80E', maxAmount: Infinity, applicableRegime: 'old' },
  { code: '80G', label: 'Donations to Charitable Trusts', section: '80G', maxAmount: Infinity, applicableRegime: 'old' },
  { code: '80TTA', label: 'Savings Interest (Deposits)', section: '80TTA', maxAmount: 10000, applicableRegime: 'old' },
  { code: '80TTB', label: 'Interest Income (Senior Citizens)', section: '80TTB', maxAmount: 50000, applicableRegime: 'old' },
  { code: '80CCD2', label: 'Employer NPS Contribution', section: '80CCD(2)', maxAmount: Infinity, applicableRegime: 'new' }
];

export function getSlabs(regime: TaxRegime): Slab[] {
  return regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
}

export function getSurchargeRate(income: number): number {
  let rate = 0;
  for (const slab of SURCHARGE_SLABS) {
    if (income > slab.incomeAbove) rate = slab.rate;
  }
  return rate;
}

export function getRebateConfig(regime: TaxRegime): RebateConfig {
  return regime === 'new' ? REBATE_87A_NEW_REGIME : REBATE_87A;
}