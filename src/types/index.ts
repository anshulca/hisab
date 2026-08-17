export type TaxRegime = 'new' | 'old';
export type BusinessType = 'business' | 'professional' | 'other';
export type UploadStatus = 'idle' | 'processing' | 'ready' | 'error';

export interface Taxpayer {
  name: string;
  pan: string;
  assessmentYear: string;
  financialYear: string;
  type: BusinessType;
  regime: TaxRegime;
  city?: string;
  state?: string;
  pinCode?: string;
  profession?: string;
}

export interface IncomeSource {
  code: string;
  label: string;
  amount: number;
  percentage?: number;
}

export interface IncomeBreakdown {
  businessIncome: number;
  capitalGains: number;
  otherSources: number;
  total: number;
  grossReceipts: number;
  sources: IncomeSource[];
}

export interface ExpenseItem {
  id: string;
  category: string;
  label: string;
  amount: number;
  percentage?: number;
}

export interface ExpenseSummary {
  total: number;
  items: ExpenseItem[];
}

export interface DepreciationAsset {
  id: string;
  blockName: string;
  rate: number;
  openingWdv: number;
  additions: number;
  sales: number;
  closingWdv: number;
  depreciation: number;
  isNew?: boolean;
}

export interface DepreciationSummary {
  totalDepreciation: number;
  assets: DepreciationAsset[];
}

export interface DeductionItem {
  code: string;
  label: string;
  amount: number;
  section: string;
}

export interface TaxComputation {
  regime: TaxRegime;
  grossTotalIncome: number;
  deductions: DeductionItem[];
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeCess: number;
  surcharge: number;
  healthCess: number;
  rebate: number;
  totalTax: number;
  advanceTax: number;
  tds: number;
  selfAssessmentTax: number;
  netTaxPayable: number;
  effectiveRate: number;
}

export interface ReportDetail {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  summary: string;
  details: ReportDetail[];
}

export interface NormalizedITR {
  taxpayer: Taxpayer;
  incomeBreakdown: IncomeBreakdown;
  expenseSummary: ExpenseSummary;
  depreciation: DepreciationSummary;
  taxComputation: TaxComputation;
  reportSections: ReportSection[];
  computedAt: string;
}

export interface PnLStatement {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  depreciation: number;
  operatingProfit: number;
  otherIncome: number;
  ebitda: number;
  netProfit: number;
  margins: {
    gross: number;
    operating: number;
    net: number;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface FileUploadState {
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  issues: ValidationIssue[];
  error?: string;
}