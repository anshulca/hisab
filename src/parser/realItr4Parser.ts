import type {
  DeductionItem,
  IncomeSource,
  NormalizedITR,
  ReportSection,
  Taxpayer,
  ValidationIssue
} from '../types';
import { computeRealRegimeTax } from '../calculation/taxEngine';
import { parseNumber } from '../utils/currency';

export interface ReconciliationReport {
  summary: {
    turnover: number;
    profitDeclared: number;
    profitMargin: number;
    marginAlert: string;
  };
  tdsReconciliation: {
    totalClaimed: number;
    tdsRatio: number;
    tdsAlert: string;
  };
  taxComparison: {
    officialTaxLiability: number;
    manualRecalculatedLiability: number;
    expectedRefund: number;
    refundAsPerReturn: number;
    dispute: string;
  };
}

function pick(obj: unknown, keys: string[]): number {
  if (!obj || typeof obj !== 'object') return 0;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      const n = parseNumber(value);
      if (n !== 0) return n;
    }
  }
  return 0;
}

export function parseRealItr4(input: unknown): {
  normalized: NormalizedITR;
  issues: ValidationIssue[];
  reconciliation: ReconciliationReport;
} {
  const issues: ValidationIssue[] = [];
  const root = (input ?? {}) as Record<string, unknown>;
  const itr = (root.ITR ?? {}) as Record<string, unknown>;
  const itr4 = (itr.ITR4 ?? {}) as Record<string, unknown>;

  const personalInfo = (itr4.PersonalInfo ?? {}) as Record<string, unknown>;
  const assesseeName = (personalInfo.AssesseeName ?? {}) as Record<string, unknown>;
  const address = (personalInfo.Address ?? {}) as Record<string, unknown>;

  const firstName = String(assesseeName.FirstName ?? assesseeName.Name ?? '');
  const middleName = String(assesseeName.MiddleName ?? '');
  const surName = String(assesseeName.SurNameOrOrgName ?? '');
  const name = `${firstName} ${middleName} ${surName}`.replace(/\s+/g, ' ').trim() || 'Unknown Taxpayer';
  const pan = String(personalInfo.PAN ?? 'ABCDE1234F').toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    issues.push({ path: 'PersonalInfo.PAN', message: 'PAN format looks unusual.', severity: 'warning' });
  }

  const filingStatus = (itr4.FilingStatus ?? {}) as Record<string, unknown>;
  let regime: 'new' | 'old' = 'old';
  const optedOut = String(filingStatus.OptOutNewTaxRegime_Form10IEA_AY24_25 ?? '').toUpperCase();
  const noOptOut = String(filingStatus.No_OptOutNewTaxReg ?? '').toUpperCase();
  if (optedOut === 'Y') regime = 'old';
  else if (noOptOut === 'Y' || optedOut === 'N') regime = 'new';

  const incomeDeductions = (itr4.IncomeDeductions ?? {}) as Record<string, unknown>;
  const scheduleBP = (incomeDeductions.ScheduleBP ?? {}) as Record<string, unknown>;
  const presumptive = (scheduleBP.PersumptiveInc44AD ?? {}) as Record<string, unknown>;
  const turnover = pick(presumptive, ['GrsTotalTrnOver', 'GrossTotalTurnOver', 'TotalTurnOver']);
  const presumptiveIncome = pick(presumptive, ['TotPersumptiveInc44AD', 'TotalPresumptiveIncome', 'PersumptiveInc44AD']);

  const scheduleCG = incomeDeductions.ScheduleCG as Record<string, unknown> | undefined;
  const scheduleOS = incomeDeductions.ScheduleOS as Record<string, unknown> | undefined;
  const capitalGains = pick(scheduleCG, ['TotCptlGain', 'TotalCapitalGain', 'CptlGain', 'GrossCptlGain']);
  const otherSources = pick(scheduleOS, ['TotalSchOS', 'GrossOtherSrc', 'TotalOtherSrc', 'TotOtherSrc', 'GrossOtherSources']);

  const taxPaid = (itr4.TaxPaid ?? {}) as Record<string, unknown>;
  const taxesPaid = (taxPaid.TaxesPaid ?? {}) as Record<string, unknown>;
  const tdsTotal = pick(taxesPaid, ['TDS', 'Tds', 'TotalTDS']);
  const advanceTax = pick(taxesPaid, ['AdvanceTax']);
  const selfAssessmentTax = pick(taxesPaid, ['SelfAssessmentTax']);

  const taxComp = (itr4.TaxComputation ?? {}) as Record<string, unknown>;
  const officialNetLiability = pick(taxComp, ['NetTaxLiability', 'NetTaxPayable', 'TotalTaxPayable']);

  const refund = (itr4.Refund ?? {}) as Record<string, unknown>;
  const refundDue = pick(refund, ['RefundDue']);

  const finances = (scheduleBP.FinanclPartclrOfBusiness ?? {}) as Record<string, unknown>;
  const balanceSheet = {
    totalAssets: pick(finances, ['TotalAssets']),
    cashInHand: pick(finances, ['CashInHand']),
    sundryDebtors: pick(finances, ['SundryDebtors']),
    fixedAssets: pick(finances, ['FixedAssets']),
    capitalLiabilities: pick(finances, ['TotCapLiabilities', 'TotalCapLiabilities']),
    securedLoans: pick(finances, ['SecuredLoans']),
    unsecuredLoans: pick(finances, ['UnSecuredLoans'])
  };

  const totalIncome = presumptiveIncome + capitalGains + otherSources;

  const taxpayer: Taxpayer = {
    name,
    pan,
    assessmentYear: String(personalInfo.AssessmentYear ?? '2024-25'),
    financialYear: String(personalInfo.FinancialYear ?? '2023-24'),
    type: 'business',
    regime,
    city: String(address.CityOrTownOrDistrict ?? address.City ?? ''),
    state: String(address.State ?? ''),
    pinCode: String(address.PINCode ?? address.PinCode ?? ''),
    profession: 'Presumptive Business (44AD)'
  };

  const manualTax = computeRealRegimeTax(totalIncome, regime, 0);

  const taxComputation = {
    regime,
    grossTotalIncome: totalIncome,
    deductions: [] as DeductionItem[],
    totalDeductions: 0,
    taxableIncome: manualTax.taxableIncome,
    taxBeforeCess: manualTax.taxBeforeRebate,
    surcharge: 0,
    healthCess: manualTax.cess,
    rebate: manualTax.rebate,
    totalTax: manualTax.totalPayable,
    advanceTax,
    tds: tdsTotal,
    selfAssessmentTax,
    netTaxPayable: Math.max(0, manualTax.totalPayable - advanceTax - tdsTotal - selfAssessmentTax),
    effectiveRate: totalIncome > 0 ? (manualTax.totalPayable / totalIncome) * 100 : 0
  };

  const profitMargin = turnover > 0 ? (presumptiveIncome / turnover) * 100 : 0;
  const marginAlert =
    profitMargin > 8
      ? `High margin (${profitMargin.toFixed(2)}%). Section 44AD needs only 6-8% profit to be eligible.`
      : 'Profit margin is within normal limits.';

  const tdsRatio = turnover > 0 ? (tdsTotal / turnover) * 100 : 0;
  const tdsAlert =
    tdsRatio > 2
      ? `TDS is ${tdsRatio.toFixed(2)}% of turnover - unusually high. Verify section codes (194-O is 1%, 194J is 10%).`
      : 'TDS ratio is normal.';

  const expectedRefund = tdsTotal - manualTax.totalPayable;
  const dispute =
    officialNetLiability !== 0 && officialNetLiability !== manualTax.totalPayable
      ? `Mismatch between ITR record (₹${officialNetLiability.toLocaleString('en-IN')}) and manual calc (₹${manualTax.totalPayable.toLocaleString('en-IN')}).`
      : 'Calculation matches official record.';

  const reconciliation: ReconciliationReport = {
    summary: { turnover, profitDeclared: presumptiveIncome, profitMargin, marginAlert },
    tdsReconciliation: { totalClaimed: tdsTotal, tdsRatio, tdsAlert },
    taxComparison: {
      officialTaxLiability: officialNetLiability,
      manualRecalculatedLiability: manualTax.totalPayable,
      expectedRefund,
      refundAsPerReturn: refundDue,
      dispute
    }
  };

  const sourceRows: IncomeSource[] = [
    {
      code: 'PGBP',
      label: 'Profits & Gains of Business/Profession',
      amount: presumptiveIncome,
      percentage: totalIncome ? (presumptiveIncome / totalIncome) * 100 : 0
    },
    {
      code: 'CG',
      label: 'Capital Gains',
      amount: capitalGains,
      percentage: totalIncome ? (capitalGains / totalIncome) * 100 : 0
    },
    {
      code: 'OS',
      label: 'Income from Other Sources',
      amount: otherSources,
      percentage: totalIncome ? (otherSources / totalIncome) * 100 : 0
    }
  ].filter((s) => s.amount !== 0);

  const reportSections: ReportSection[] = [
    {
      id: 'cover',
      title: 'Cover Page',
      summary: 'Taxpayer details extracted from the ITR-4 JSON.',
      details: [
        { label: 'Name', value: taxpayer.name },
        { label: 'PAN', value: taxpayer.pan },
        { label: 'Assessment Year', value: taxpayer.assessmentYear },
        { label: 'Financial Year', value: taxpayer.financialYear },
        { label: 'Tax Regime', value: regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime' },
        { label: 'City', value: taxpayer.city || '—' },
        { label: 'State', value: taxpayer.state || '—' }
      ]
    },
    {
      id: 'income',
      title: 'Income Summary',
      summary: `Gross total income of ₹${totalIncome.toLocaleString('en-IN')} for AY ${taxpayer.assessmentYear}.`,
      details: [
        { label: 'Gross Turnover (44AD)', value: turnover },
        { label: 'Presumptive Business Income', value: presumptiveIncome },
        { label: 'Capital Gains', value: capitalGains },
        { label: 'Income from Other Sources', value: otherSources },
        { label: 'Gross Total Income', value: totalIncome }
      ]
    },
    {
      id: 'reconciliation',
      title: 'Hisab Reconciliation',
      summary: 'Automated checks on presumptive margin, TDS ratio and tax liability.',
      details: [
        { label: 'Profit Margin', value: `${profitMargin.toFixed(2)}%` },
        { label: 'Margin Check', value: marginAlert },
        { label: 'TDS / Turnover', value: `${tdsRatio.toFixed(2)}%` },
        { label: 'TDS Check', value: tdsAlert },
        { label: 'Official Tax Liability', value: officialNetLiability },
        { label: 'Recalculated Liability', value: manualTax.totalPayable },
        { label: 'Expected Refund', value: expectedRefund },
        { label: 'Dispute', value: dispute }
      ]
    },
    {
      id: 'balancesheet',
      title: 'Balance Sheet as per Schedule BP',
      summary: 'Financial particulars of business as declared.',
      details: [
        { label: 'Cash in Hand', value: balanceSheet.cashInHand },
        { label: 'Sundry Debtors', value: balanceSheet.sundryDebtors },
        { label: 'Fixed Assets', value: balanceSheet.fixedAssets },
        { label: 'Secured Loans', value: balanceSheet.securedLoans },
        { label: 'Unsecured Loans', value: balanceSheet.unsecuredLoans },
        { label: 'Capital & Liabilities', value: balanceSheet.capitalLiabilities },
        { label: 'Total Assets', value: balanceSheet.totalAssets }
      ]
    },
    {
      id: 'tax',
      title: 'Tax Computation',
      summary: `Under ${regime === 'new' ? 'New' : 'Old'} regime, total tax payable is ₹${manualTax.totalPayable.toLocaleString('en-IN')}.`,
      details: [
        { label: 'Taxable Income', value: manualTax.taxableIncome },
        { label: 'Tax before Cess', value: manualTax.taxBeforeRebate },
        { label: 'Rebate (87A)', value: manualTax.rebate },
        { label: 'Health & Edu Cess (4%)', value: manualTax.cess },
        { label: 'Total Tax Payable', value: manualTax.totalPayable },
        { label: 'Advance Tax', value: advanceTax },
        { label: 'TDS', value: tdsTotal },
        { label: 'Net Tax Payable', value: taxComputation.netTaxPayable }
      ]
    }
  ];

  const normalized: NormalizedITR = {
    taxpayer,
    incomeBreakdown: {
      businessIncome: presumptiveIncome,
      capitalGains,
      otherSources,
      total: totalIncome,
      grossReceipts: turnover,
      sources: sourceRows
    },
    expenseSummary: { total: 0, items: [] },
    depreciation: { totalDepreciation: 0, assets: [] },
    taxComputation,
    reportSections,
    computedAt: new Date().toISOString()
  };

  return { normalized, issues, reconciliation };
}
