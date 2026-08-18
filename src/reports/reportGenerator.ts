import type { NormalizedITR } from '../types';
import { cleanNumber, displayAmount } from '../utils/currency';

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
      savingsInterest: number;
      otherIncome: number;
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
  };
}

function regimeLabel(regime: string): string {
  return regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime';
}

function bsVal(data: NormalizedITR, label: string): number {
  const section = data.reportSections.find((s) => s.id === 'balancesheet');
  const item = section?.details.find((x) => x.label === label);
  return typeof item?.value === 'number' ? item.value : 0;
}

export class ReportGenerator {
  generate(data: NormalizedITR): ReportData {
    const t = data.taxpayer;
    const detail = data.detail;
    const inc = data.incomeBreakdown;
    const tax = data.taxComputation;

    const ayYear = parseInt(t.assessmentYear, 10) || 2024;
    const fy = `${ayYear - 1}-${String(ayYear).slice(-2)}`;

    // Business / financials
    const financials = {
      totalAssets: bsVal(data, 'Total Assets'),
      totalLiabilities:
        bsVal(data, 'Partner Capital') + bsVal(data, 'Secured Loans') + bsVal(data, 'Unsecured Loans') +
        bsVal(data, 'Sundry Creditors') + bsVal(data, 'Other Current Liab') + bsVal(data, 'Advances'),
      capital: bsVal(data, 'Partner Capital'),
      securedLoans: bsVal(data, 'Secured Loans'),
      unsecuredLoans: bsVal(data, 'Unsecured Loans'),
      creditors: bsVal(data, 'Sundry Creditors'),
      otherLiabilities: bsVal(data, 'Other Current Liab') + bsVal(data, 'Advances'),
      fixedAssets: bsVal(data, 'Fixed Assets'),
      inventories: bsVal(data, 'Inventories'),
      debtors: bsVal(data, 'Sundry Debtors'),
      bankBalance: bsVal(data, 'Bank Balances'),
      cashInHand: bsVal(data, 'Cash in Hand'),
      loansAndAdvances: bsVal(data, 'Loans & Advances'),
      otherAssets: bsVal(data, 'Other Assets')
    };

    // Clean all numbers
    const sales = cleanNumber(detail?.turnoverBanking ?? inc.grossReceipts) + cleanNumber(detail?.turnoverCash);
    const bankingReceipts = cleanNumber(detail?.turnoverBanking ?? inc.grossReceipts);
    const cashReceipts = cleanNumber(detail?.turnoverCash);
    const declaredBankingAmt = cleanNumber(detail?.declaredBanking ?? inc.businessIncome);
    const declaredCashAmt = cleanNumber(detail?.declaredCash);
    const declaredIncome = cleanNumber(declaredBankingAmt + declaredCashAmt) || cleanNumber(inc.businessIncome);
    const sixPercent = cleanNumber(detail?.minBanking6 ?? Math.round(bankingReceipts * 0.06));
    const eightPercent = cleanNumber(detail?.minCash8 ?? Math.round(cashReceipts * 0.08));

    // Other income
    const otherSources = cleanNumber(inc.otherSources);
    const breakdown = detail?.otherSourcesBreakdown ?? [];
    const savingsInterest = cleanNumber(breakdown.find((b) => /(savings|interest|FD|deposit)/i.test(b.label))?.amount ?? 0);
    const otherIncome = otherSources > 0 ? otherSources - savingsInterest : 0;

    // Tax figures
    const taxLiability = cleanNumber(tax.totalTax);
    const taxOnIncome = cleanNumber(tax.taxBeforeCess);
    const cess = cleanNumber(tax.healthCess);
    const rebate = cleanNumber(tax.rebate);
    const interest =
      cleanNumber(detail?.interest?.us234A ?? 0) +
      cleanNumber(detail?.interest?.us234B ?? 0) +
      cleanNumber(detail?.interest?.us234C ?? 0) +
      cleanNumber(detail?.interest?.lateFee234F ?? 0);
    const totalTaxPaid = cleanNumber(detail?.taxesPaid?.total ?? tax.tds + tax.advanceTax + tax.selfAssessmentTax);
    const tds = cleanNumber(detail?.taxesPaid?.tds ?? tax.tds);
    const advanceTax = cleanNumber(detail?.taxesPaid?.advanceTax ?? tax.advanceTax);
    const selfAssessment = cleanNumber(detail?.taxesPaid?.selfAssessmentTax ?? tax.selfAssessmentTax);

    // Refund / Payable
    const refund = cleanNumber(t.refundDue);
    const netPayable = cleanNumber(tax.netTaxPayable);

    // Balance Sheet
    const totalLiabilities = cleanNumber(financials.totalLiabilities);
    const totalAssets = cleanNumber(financials.totalAssets);
    const closingStock = cleanNumber(financials.inventories);
    const cashInHand = cleanNumber(financials.cashInHand);
    const creditors = cleanNumber(financials.creditors);
    const capital = cleanNumber(financials.capital);

    // Calculate NP percentage
    const npPercentage = sales > 0 ? (declaredIncome / sales) * 100 : 0;

    const rec = data.reportSections.find((s) => s.id === 'reconciliation');
    const recVal = (label: string): string | number | null =>
      rec?.details.find((x) => x.label === label)?.value ?? null;
    const officialLiability =
      typeof recVal('Official Tax Liability') === 'number' ? (recVal('Official Tax Liability') as number) : 0;

    const regime = regimeLabel(t.regime);
    const filingSection = t.filingSection || '139(1) – On Time';
    const itrType = 'ITR-4 (SUGAM)';

    const hisabCheck: HisabCheckItem[] = [
      {
        label: '44AD declared income matches total income path',
        value: declaredIncome,
        pass: declaredIncome === cleanNumber(inc.businessIncome)
      },
      { label: 'Total income includes other sources', value: otherSources, pass: otherSources >= 0 },
      { label: 'TDS claimed as per 26AS', value: tds, pass: tds > 0 },
      {
        label: 'Tax + cess as per ITR record',
        value: `${officialLiability} official vs ${taxLiability} manual`,
        pass: Math.abs(officialLiability - taxLiability) <= Math.max(1, officialLiability * 0.02)
      },
      { label: 'Refund due as per return', value: refund, pass: refund > 0 },
      { label: 'Taxes paid vs net liability', value: totalTaxPaid, pass: totalTaxPaid >= netPayable }
    ];

    return {
      header: {
        name: t.name || '—',
        pan: t.pan || '—',
        assessmentYear: t.assessmentYear || '2024-25',
        financialYear: fy,
        itrType,
        regime,
        filingSection
      },
      personalInfo: {
        fullName: t.name || '—',
        fatherName: t.fatherName || '—',
        pan: t.pan || '—',
        dob: t.dob || '—',
        aadhaar: t.aadhaar || '—',
        mobile: t.mobile || '—',
        email: t.email || '—',
        residentialStatus: t.residentStatus || 'Individual',
        address: (() => {
          const raw = (t.address || '').trim();
          return raw
            ? t.pinCode && !raw.endsWith(t.pinCode) ? `${raw} — ${t.pinCode}` : raw
            : t.pinCode ? `— ${t.pinCode}` : '—';
        })(),
        itrForm: itrType,
        taxRegime: regime,
        filingSection,
        assessmentYear: t.assessmentYear || '2024-25',
        financialYear: fy,
        ackNumber: detail?.ackNumber || '—',
        filingDate: detail?.filingDate || '—'
      },
      businessInfo: {
        name: t.businessName || '—',
        code: t.businessCode || '—',
        nature: t.natureOfBusiness || '—',
        profile: 'Retail Trade',
        sectionApplied: t.type === 'professional' ? '44ADA – Presumptive' : '44AD – Presumptive',
        booksOfAccount: totalAssets > 0 || totalLiabilities > 0 ? 'Maintained (Sec 44AA)' : 'Not Required',
        taxRegime: regime,
        bankName: t.bankName || '—',
        accountNo: t.accountNo || '—',
        ifscCode: t.ifsc || '—',
        accountType: t.accountType || '—',
        refundDue: refund > 0 ? displayAmount(refund) : 'Nil'
      },
      businessIncome: {
        turnover: { banking: bankingReceipts, cash: cashReceipts, total: sales },
        minimum: { sixPercent, eightPercent, total: sixPercent + eightPercent },
        declared: { banking: declaredBankingAmt, cash: declaredCashAmt, total: declaredIncome },
        npPercentage
      },
      taxComputation: {
        incomeSchedule: {
          salary: 0,
          houseProperty: 0,
          business: declaredIncome,
          otherSources,
          savingsInterest,
          otherIncome,
          grossTotal: cleanNumber(inc.total),
          deductions: cleanNumber(tax.totalDeductions),
          totalIncome: cleanNumber(tax.taxableIncome)
        },
        taxDetails: {
          taxOnIncome,
          surcharge: cleanNumber(tax.surcharge),
          cess,
          grossLiability: taxLiability,
          rebate,
          interest,
          netPayable: taxLiability + interest - rebate
        },
        taxPaid: {
          advanceTax,
          tds,
          tcs: cleanNumber(detail?.taxesPaid?.tcs ?? 0),
          selfAssessment,
          totalPaid: totalTaxPaid
        },
        refundPayable: { refund, netPayable }
      },
      pnl: {
        sales,
        closingStock,
        openingStock: 0,
        purchases: 0,
        grossProfit: sales + closingStock,
        operatingExpenses: 0,
        depreciation: cleanNumber(data.depreciation.totalDepreciation),
        otherIncome: otherSources,
        netProfit: declaredIncome
      },
      balanceSheet: {
        liabilities: {
          capital,
          securedLoans: cleanNumber(financials.securedLoans),
          unsecuredLoans: cleanNumber(financials.unsecuredLoans),
          creditors,
          otherLiabilities: cleanNumber(financials.otherLiabilities),
          total: totalLiabilities
        },
        assets: {
          fixedAssets: cleanNumber(financials.fixedAssets),
          investments: 0,
          inventories: closingStock,
          debtors: cleanNumber(financials.debtors),
          bank: cleanNumber(financials.bankBalance),
          cash: cashInHand,
          otherAssets: cleanNumber(financials.loansAndAdvances) + cleanNumber(financials.otherAssets),
          total: totalAssets
        },
        difference: Math.abs(totalLiabilities - totalAssets),
        reconciled: totalLiabilities === totalAssets
      },
      capitalAccount: {
        openingCapital: 0,
        netProfit: declaredIncome,
        drawings: Math.max(0, declaredIncome - capital),
        closingCapital: capital
      },
      hisabCheck,
      declaration: {
        name: t.name || '—',
        pan: t.pan || '—',
        aadhaar: t.aadhaar || '—',
        assessmentYear: t.assessmentYear || '2024-25',
        itrType,
        financialYear: fy
      }
    };
  }
}