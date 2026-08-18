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
  itr3?: Itr3Detail;
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

/*
 * ============================================================
 * ITR-3 model — Individuals / HUFs with business or profession
 * Mirrors the ITR-1 model conventions (Valued + SourceTag).
 * All additions optional/backward compatible.
 * ============================================================
 */

export interface Itr3Employer {
  name: string;
  tan: string;
  natureOfEmployment: string;
  address: string;
}

export interface Itr3Salary {
  employers: Itr3Employer[];
  grossSalary: Valued;
  exemptAllowances: Valued;
  hra: {
    present: boolean;
    hraReceived: Valued;
    rentPaid: Valued;
    eligibleExemption: Valued;
  };
  netSalary: Valued;
  standardDeduction16ia: Valued;
  professionalTax16iii: Valued;
  incomeFromSalary: Valued;
}

export interface Itr3HouseProperty {
  propertyNo: number;
  address: string;
  owner: string;
  coOwned: boolean;
  share: number;
  letOut: string;
  tenant: string;
  annualLetableValue: Valued;
  rentNotRealized: Valued;
  municipalTaxes: Valued;
  balanceALV: Valued;
  std30: Valued;
  interestOnBorrowedCapital: Valued;
  arrearsUnrealizedRent: Valued;
  incomeOrLoss: Valued;
}

export interface Itr3BusinessInfo {
  naturesOfBusiness: Array<{ code: string; tradeName: string; description: string }>;
  methodOfAccounting: string;
  booksOfAccount: string;
  audited: string;
  turnoverBand: string;
  profitBeforeTax: Valued;
  balancePL: Valued;
  netPL: Valued;
  depreciation: Valued;
  adjustedPL: Valued;
  incomeChargeable: Valued;
}

export interface Itr3DepreciationBlock {
  block: string;
  rate: number;
  openingWdv: number;
  additions: number;
  sales: number;
  depreciation: number;
  closingWdv: number;
}

export interface Itr3BalanceSheet {
  present: boolean;
  liabilities: {
    capital: number;
    securedLoans: number;
    unsecuredLoans: number;
    otherLiabilities: number;
    total: number;
  };
  assets: {
    fixedAssets: number;
    investments: number;
    inventories: number;
    debtors: number;
    bank: number;
    cash: number;
    otherAssets: number;
    total: number;
  };
  difference: number;
}

export interface Itr3PnL {
  present: boolean;
  salesOrReceipts: number;
  otherIncome: number;
  expenses: Array<{ label: string; amount: number }>;
  pbdt: number;
  pbt: number;
  netProfit: number;
}

export interface Itr3CapGainItem {
  label: string;
  fullConsideration: number;
  cost: number;
  expenses: number;
  amount: number;
}

export interface Itr3CapitalGains {
  stcg112A: Itr3CapGainItem | null;
  stcg2167: Itr3CapGainItem | null;
  stcgOther: Itr3CapGainItem | null;
  ltcg112A: Itr3CapGainItem | null;
  ltcg125: Itr3CapGainItem | null;
  totalStcg: number;
  totalLtcg: number;
  total: number;
}

export interface Itr3OtherSourcesItem {
  label: string;
  amount: number;
}

export interface Itr3OtherSources {
  savingsInterest: Valued;
  termDepositInterest: Valued;
  otherInterest: Valued;
  others: Itr3OtherSourcesItem[];
  total: Valued;
}

export interface Itr3LossHead {
  head: string;
  incomeCurrent: number;
  afterSetOff: number;
}

export interface Itr3CfLoss {
  year: string;
  dateOfFiling: string;
  businessLoss: number;
  specBusinessLoss: number;
  specifiedBusinessLoss: number;
  stcgLoss: number;
  ltcgLoss: number;
  hpLoss: number;
  otherSourceLoss: number;
}

export interface Itr3ChapterVia {
  breakdown: Array<{ code: string; label: string; amount: number }>;
  total: number;
}

export interface Itr3AmtDetail {
  adjustedTotalIncome: number;
  amtTax: number;
  amtCreditAvailable: number;
  amtCreditCarriedForward: Array<{ year: string; credit: number }>;
}

export interface Itr3SpecialIncome {
  code: string;
  rate: number;
  amount: number;
  tax: number;
}

export interface Itr3TaxLiabilityDetail {
  taxNormal: number;
  taxSpecialRates: number;
  surcharge: number;
  educationCess: number;
  grossTaxLiability: number;
  taxRelief: number;
  netTaxLiability: number;
  interest234A: number;
  interest234B: number;
  interest234C: number;
  lateFee234F: number;
  totalInterest: number;
  aggregateLiability: number;
}

export interface Itr3TaxesPaid {
  advanceTax: number;
  tds: number;
  tcs: number;
  selfAssessmentTax: number;
  total: number;
  balancePayable: number;
  challans: Array<{ bsrCode: string; date: string; cino: string; amount: number }>;
  tdsSalary: Array<{ name: string; tan: string; income: number; tds: number }>;
  tdsOther: Array<{ deductor: string; tan: string; section: string; grossAmount: number; tds: number; head: string }>;
}

export interface Itr3RefundInfo {
  refundDue: number;
  banks: Array<{ name: string; accountNo: string; ifsc: string; accountType: string; useForRefund: boolean }>;
}

export interface Itr3Verification {
  name: string;
  fatherName: string;
  pan: string;
  capacity: string;
  date: string;
  place: string;
}

export interface Itr3Detail {
  form: 'ITR3';
  assessmentYear: string;
  financialYear: string;
  regime: TaxRegime;
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
    status: string;
    residentStatus: string;
    filingSection: string;
    returnFileSec: number;
    ackNumber: string;
    filingDate: string;
  };
  salary: Itr3Salary;
  houseProperties: Itr3HouseProperty[];
  business: Itr3BusinessInfo;
  depreciation: {
    blocks: Itr3DepreciationBlock[];
    totalDepreciation: number;
  };
  balanceSheet: Itr3BalanceSheet;
  pnl: Itr3PnL;
  capitalGains: Itr3CapitalGains;
  otherSources: Itr3OtherSources;
  cyla: Itr3LossHead[];
  bfla: Itr3LossHead[];
  cfl: Itr3CfLoss[];
  via: Itr3ChapterVia;
  amt: Itr3AmtDetail;
  specialIncomes: Itr3SpecialIncome[];
  income: {
    salary: number;
    houseProperty: number;
    business: number;
    capitalGains: number;
    otherSources: number;
    grossTotal: number;
    totalIncome: number;
    aggregateIncome: number;
  };
  taxComputed: Itr3TaxLiabilityDetail;
  taxesPaid: Itr3TaxesPaid;
  refund: Itr3RefundInfo;
  verification: Itr3Verification;
}