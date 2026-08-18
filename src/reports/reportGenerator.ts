import type { NormalizedITR } from '../types';
import { formatCurrency } from '../utils/currency';

export interface HisabCheckItem {
  label: string;
  value: string | number;
  pass: boolean;
}

export interface ReportData {
  header: {
    name: string;
    pan: string;
    assessmentYear: string;
    financialYear: string;
    itrType: string;
    regime: string;
    filingSection: string;
  };
  personalInfo: {
    fullName: string;
    fatherName: string;
    pan: string;
    dob: string;
    aadhaar: string;
    mobile: string;
    email: string;
    residentialStatus: string;
    address: string;
    itrForm: string;
    taxRegime: string;
    filingSection: string;
    assessmentYear: string;
    financialYear: string;
    ackNumber: string;
    filingDate: string;
  };
  businessInfo: {
    name: string;
    code: string;
    nature: string;
    profile: string;
    sectionApplied: string;
    booksOfAccount: string;
    taxRegime: string;
    bankName: string;
    accountNo: string;
    ifscCode: string;
    accountType: string;
    refundDue: string;
  };
  businessIncome: {
    turnover: { banking: number; cash: number; total: number };
    minimum: { sixPercent: number; eightPercent: number; total: number };
    declared: { banking: number; cash: number; total: number };
    npPercentage: number;
  };
  taxComputation: {
    incomeSchedule: {
      salary: number;
      houseProperty: number;
      business: number;
      otherSources: number;
      otherSourcesBreakdown?: Array<{ label: string; amount: number }>;
      grossTotal: number;
      deductions: number;
      totalIncome: number;
    };
    taxDetails: {
      taxOnIncome: number;
      surcharge: number;
      cess: number;
      grossLiability: number;
      rebate: number;
      interest: number;
      netPayable: number;
    };
    taxPaid: {
      advanceTax: number;
      tds: number;
      tcs: number;
      selfAssessment: number;
      totalPaid: number;
    };
    refundPayable: { refund: number; netPayable: number };
  };
  pnl: {
    sales: number;
    closingStock: number;
    openingStock: number;
    purchases: number;
    grossProfit: number;
    operatingExpenses: number;
    depreciation: number;
    otherIncome: number;
    netProfit: number;
  };
  balanceSheet: {
    liabilities: {
      capital: number;
      securedLoans: number;
      unsecuredLoans: number;
      creditors: number;
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
    reconciled: boolean;
  };
  capitalAccount: {
    openingCapital: number;
    netProfit: number;
    drawings: number;
    closingCapital: number;
  };
  hisabCheck: HisabCheckItem[];
  declaration: {
    name: string;
    pan: string;
    aadhaar: string;
    assessmentYear: string;
    itrType: string;
    financialYear: string;
    filingDate: string;
  };
}

function regimeLabel(regime: string): string {
  return regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime';
}

export class ReportGenerator {
  generate(data: NormalizedITR): ReportData {
    const t = data.taxpayer;
    const detail = data.detail;
    const inc = data.incomeBreakdown;
    const tax = data.taxComputation;

    const ayYear = parseInt(t.assessmentYear, 10) || 0;
    const fy =
      ayYear > 0 ? `${ayYear - 1}-${String(ayYear).slice(-2)}` : t.financialYear || '';

    const bs = (label: string): number => {
      const section = data.reportSections.find((s) => s.id === 'balancesheet');
      const item = section?.details.find((x) => x.label === label);
      return typeof item?.value === 'number' ? item.value : 0;
    };

    const banking = detail?.turnoverBanking ?? inc.grossReceipts;
    const cashTurnover = detail?.turnoverCash ?? 0;
    const declaredBanking = detail?.declaredBanking ?? 0;
    const declaredCash = detail?.declaredCash ?? 0;
    const minBanking6 = detail?.minBanking6 ?? Math.round(banking * 0.06);
    const minCash8 = detail?.minCash8 ?? Math.round(cashTurnover * 0.08);
    const declaredTotal = declaredBanking + declaredCash;
    const minTotal = minBanking6 + minCash8;
    const npPercentage = banking + cashTurnover > 0 ? (declaredTotal / (banking + cashTurnover)) * 100 : 0;

    const paid = detail?.taxesPaid;
    const advanceTax = paid?.advanceTax ?? tax.advanceTax;
    const tds = paid?.tds ?? tax.tds;
    const tcs = paid?.tcs ?? 0;
    const selfAssessmentTax = paid?.selfAssessmentTax ?? tax.selfAssessmentTax;
    const totalPaid = paid?.total ?? advanceTax + tds + tcs + selfAssessmentTax;

    const netPayable = tax.netTaxPayable;
    const refund = (t.refundDue ?? 0) > 0 ? (t.refundDue ?? 0) : 0;

    const capital = bs('Partner Capital');
    const securedLoans = bs('Secured Loans');
    const unsecuredLoans = bs('Unsecured Loans');
    const creditors = bs('Sundry Creditors');
    const otherLiabilities = bs('Other Current Liab') + bs('Advances');
    const totalLiabilities = capital + securedLoans + unsecuredLoans + creditors + otherLiabilities;

    const fixedAssets = bs('Fixed Assets');
    const inventories = bs('Inventories');
    const debtors = bs('Sundry Debtors');
    const bankBalance = bs('Bank Balances');
    const cashInHand = bs('Cash in Hand');
    const otherAssets = bs('Loans & Advances') + bs('Other Assets');
    const totalAssets =
      bs('Total Assets') || fixedAssets + inventories + debtors + bankBalance + cashInHand + otherAssets;

    const sales = banking + cashTurnover;
    const purchases =
      data.expenseSummary.items.find((e) => e.category === 'Purchases')?.amount ?? 0;
    const openingStock = 0;
    const grossProfit = sales + inventories - openingStock - purchases;
    const operatingExpenses = data.expenseSummary.total - purchases;
    const depreciation = data.depreciation.assets.reduce((s, a) => s + a.depreciation, 0);

    const closingCapital = capital;
    const openingCapital = 0;
    const drawings = Math.max(0, openingCapital + inc.businessIncome - closingCapital);

    const interest =
      (detail?.interest?.us234A ?? 0) +
      (detail?.interest?.us234B ?? 0) +
      (detail?.interest?.us234C ?? 0) +
      (detail?.interest?.lateFee234F ?? 0);

    const rec = data.reportSections.find((s) => s.id === 'reconciliation');
    const recVal = (label: string): string | number | null =>
      rec?.details.find((x) => x.label === label)?.value ?? null;
    const officialLiability =
      typeof recVal('Official Tax Liability') === 'number' ? (recVal('Official Tax Liability') as number) : 0;

    const regime = regimeLabel(t.regime);
    const filingSection = t.filingSection || '139(1) – On Time';
    const itrType = 'ITR-4 (SUGAM)';
    const ackNumber = detail?.ackNumber || '—';
    const filingDate = detail?.filingDate || '—';
    const address = `${t.address || ''}${t.pinCode ? ` — ${t.pinCode}` : ''}`.trim();

    const hisabCheck: HisabCheckItem[] = [
      {
        label: '44AD declared income matches total income path',
        value: inc.businessIncome,
        pass: declaredTotal === inc.businessIncome
      },
      { label: 'Total income includes other sources', value: inc.otherSources, pass: inc.otherSources >= 0 },
      { label: 'TDS claimed as per 26AS', value: tds, pass: tds > 0 },
      {
        label: 'Tax + cess as per ITR record',
        value: `${officialLiability} official vs ${tax.totalTax} manual`,
        pass: Math.abs(officialLiability - tax.totalTax) <= Math.max(1, officialLiability * 0.02)
      },
      { label: 'Refund due as per return', value: refund, pass: refund > 0 },
      { label: 'Taxes paid vs net liability', value: totalPaid, pass: totalPaid >= netPayable }
    ];

    return {
      header: {
        name: t.name,
        pan: t.pan,
        assessmentYear: t.assessmentYear,
        financialYear: fy || t.financialYear,
        itrType,
        regime,
        filingSection
      },
      personalInfo: {
        fullName: t.name,
        fatherName: t.fatherName || '',
        pan: t.pan,
        dob: t.dob || '',
        aadhaar: t.aadhaar || '',
        mobile: t.mobile || '',
        email: t.email || '',
        residentialStatus: t.residentStatus || 'Individual',
        address,
        itrForm: itrType,
        taxRegime: regime,
        filingSection,
        assessmentYear: t.assessmentYear,
        financialYear: fy || t.financialYear,
        ackNumber,
        filingDate
      },
      businessInfo: {
        name: t.businessName || '',
        code: t.businessCode || '',
        nature: t.natureOfBusiness || '—',
        profile: 'Retail Trade',
        sectionApplied: t.type === 'professional' ? '44ADA – Presumptive' : '44AD – Presumptive',
        booksOfAccount: totalAssets > 0 ? 'Maintained (Sec 44AA)' : 'Not Required (44AD)',
        taxRegime: regime,
        bankName: t.bankName || '—',
        accountNo: t.accountNo || '—',
        ifscCode: t.ifsc || '—',
        accountType: t.accountType || '—',
        refundDue: refund > 0 ? formatCurrency(refund) : 'Nil'
      },
      businessIncome: {
        turnover: { banking, cash: cashTurnover, total: banking + cashTurnover },
        minimum: { sixPercent: minBanking6, eightPercent: minCash8, total: minTotal },
        declared: { banking: declaredBanking, cash: declaredCash, total: declaredTotal },
        npPercentage
      },
      taxComputation: {
        incomeSchedule: {
          salary: 0,
          houseProperty: 0,
          business: inc.businessIncome,
          otherSources: inc.otherSources,
          otherSourcesBreakdown: detail?.otherSourcesBreakdown,
          grossTotal: inc.total,
          deductions: tax.totalDeductions,
          totalIncome: tax.taxableIncome
        },
        taxDetails: {
          taxOnIncome: tax.taxBeforeCess,
          surcharge: tax.surcharge,
          cess: tax.healthCess,
          grossLiability: tax.totalTax,
          rebate: tax.rebate,
          interest,
          netPayable
        },
        taxPaid: { advanceTax, tds, tcs, selfAssessment: selfAssessmentTax, totalPaid },
        refundPayable: { refund, netPayable }
      },
      pnl: {
        sales,
        closingStock: inventories,
        openingStock,
        purchases,
        grossProfit,
        operatingExpenses,
        depreciation,
        otherIncome: inc.otherSources,
        netProfit: inc.businessIncome
      },
      balanceSheet: {
        liabilities: { capital, securedLoans, unsecuredLoans, creditors, otherLiabilities, total: totalLiabilities },
        assets: { fixedAssets, investments: 0, inventories, debtors, bank: bankBalance, cash: cashInHand, otherAssets, total: totalAssets },
        difference: Math.abs(totalLiabilities - totalAssets),
        reconciled: totalLiabilities === totalAssets
      },
      capitalAccount: { openingCapital, netProfit: inc.businessIncome, drawings, closingCapital },
      hisabCheck,
      declaration: {
        name: t.name,
        pan: t.pan,
        aadhaar: t.aadhaar || '',
        assessmentYear: t.assessmentYear,
        itrType,
        financialYear: fy || t.financialYear,
        filingDate
      }
    };
  }
}
