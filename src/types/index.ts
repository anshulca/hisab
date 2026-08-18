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
  fatherName?: string;
  dob?: string;
  aadhaar?: string;
  mobile?: string;
  email?: string;
  residentStatus?: string;
  filingSection?: string;
  address?: string;
  businessName?: string;
  businessCode?: string;
  natureOfBusiness?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  accountType?: string;
  refundDue?: number;
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
  itrForm?: ITRForm;
  itr1?: Itr1Detail;
  detail?: {
    turnoverBanking: number;
    turnoverCash: number;
    declaredBanking: number;
    declaredCash: number;
    minBanking6: number;
    minCash8: number;
    npPercent: number;
    otherSourcesBreakdown: Array<{ label: string; amount: number }>;
    taxesPaid: {
      advanceTax: number;
      selfAssessmentTax: number;
      tds: number;
      tcs: number;
      total: number;
      balancePayable: number;
    };
    interest: {
      us234A: number;
      us234B: number;
      us234C: number;
      lateFee234F: number;
      totalWithInterest: number;
    };
    slabRows: Array<{ from: number; to: number; rate: number; tax: number }>;
    ackNumber: string;
    filingDate: string;
  };
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

/* ============================================================
   ITR Form detection & ITR-1 (SAHAJ) model
   Added for ITR-1 support. All additions are optional/backward
   compatible — nothing in the ITR-4 path depends on them.
   ============================================================ */

export type ITRForm = 'ITR1' | 'ITR4' | 'ITR3' | 'UNKNOWN';

/** Provenance tag used across the ITR-1 model (never label calculation as JSON). */
export type SourceTag = 'JSON' | 'CALCULATED' | 'RECONSTRUCTED' | 'VERIFIED' | 'USER_INPUT';

export interface Valued {
  value: number;
  source: SourceTag;
}

export interface Itr1Salary {
  gross: Valued;
  salaryComponent: Valued;
  perquisites: Valued;
  profitsInSalary: Valued;
  exemptAllowances: Valued;
  netSalary: Valued;
  standardDeduction16ia: Valued;
  entertainment16ii: Valued;
  professionalTax16iii: Valued;
  incomeFromSalary: Valued;
}

export interface Itr1HouseProperty {
  propertyType?: string;
  address?: string;
  grossRent: Valued;
  municipalTax: Valued;
  annualValue: Valued;
  standardDeduction: Valued;
  interestOnBorrowedCapital: Valued;
  arrearsUnrealizedRent: Valued;
  incomeOrLoss: Valued;
}

export interface Itr1OtherSource {
  natureCode: string;
  description: string;
  amount: Valued;
}

export interface Itr1Deduction {
  code: string;
  label: string;
  section: string;
  amount: Valued;
}

export interface Itr1Ltc112a {
  saleConsideration: Valued;
  costOfAcquisition: Valued;
  longTermGain: Valued;
}

export interface Itr1BankDetail {
  name: string;
  accountNo: string;
  ifsc: string;
  accountType: string;
  useForRefund: boolean;
}

export interface Itr1Detail {
  form: 'ITR1';
  assessmentYear: string;
  financialYear: string;
  personal: {
    name: string;
    pan: string;
    fatherName: string;
    dob: string;
    aadhaar: string;
    mobile: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pinCode: string;
    employerCategory: string;
    secondaryAddress?: string;
    residentStatus: string;
    filingSection: string;
    returnFileSec: number;
    ackNumber: string;
    filingDate: string;
  };
  salary: Itr1Salary;
  houseProperties: Itr1HouseProperty[];
  otherSources: Itr1OtherSource[];
  otherSourcesTotal: Valued;
  savingsInterestDeduction: Valued;
  exemptAgriIncome: Valued;
  deductions: Itr1Deduction[];
  totalDeductions: Valued;
  ltc112a: Itr1Ltc112a;
  income: {
    salary: Valued;
    houseProperty: Valued;
    otherSources: Valued;
    capitalGains: Valued;
    grossTotalIncomeCalculated: Valued;
    grossTotalIncomeReported: Valued;
    totalIncomeReported: Valued;
    taxableIncomeCalculated: Valued;
    totalIncomeRounded: Valued;
  };
  taxComputed: {
    taxOnIncomeNormal: Valued;
    taxOnLtc112a: Valued;
    rebate87A: Valued;
    surcharge: Valued;
    educationCess: Valued;
    grossTaxLiability: Valued;
    totalTaxPayable: Valued;
    interest234: Valued;
    netTaxPayable: Valued;
  };
  taxReported: {
    taxPayable: Valued;
    rebate87A: Valued;
    cess: Valued;
    grossLiability: Valued;
    netLiability: Valued;
    totalInterest: Valued;
    totalTaxPlusInterest: Valued;
  };
  taxesPaid: {
    advanceTax: Valued;
    tds: Valued;
    tcs: Valued;
    selfAssessmentTax: Valued;
    total: Valued;
    balancePayable: Valued;
  };
  refundReported: Valued;
  bank: Itr1BankDetail | null;
  ltcPresent: boolean;
}