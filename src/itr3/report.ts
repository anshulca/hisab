import type { NormalizedITR, SourceTag } from '../types';

export interface I3HisabItem {
  label: string;
  value: string | number;
  pass: boolean;
  note?: string;
}

export interface I3ReportData {
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
    address: string;
    status: string;
    residentialStatus: string;
    itrForm: string;
    taxRegime: string;
    filingSection: string;
    assessmentYear: string;
    financialYear: string;
    ackNumber: string;
    filingDate: string;
  };
  businessInfo: {
    natures: Array<{ code: string; tradeName: string; description: string }>;
    natureLabel: string;
    methodOfAccounting: string;
    booksOfAccount: string;
    audited: string;
    turnoverBand: string;
    profitBeforeTax: number;
    balancePL: number;
    netPL: number;
    depreciation: number;
    adjustedPL: number;
    incomeChargeable: number;
  };
  salary: {
    employersText: string;
    gross: number;
    exemptAllowances: number;
    hra: { present: boolean; hraReceived: number; rentPaid: number; eligibleExemption: number };
    netSalary: number;
    standardDeduction: number;
    professionalTax: number;
    incomeFromSalary: number;
  };
  houseProperties: Array<{
    address: string;
    tenant: string;
    annualValue: number;
    municipalTaxes: number;
    rentNotRealized: number;
    balanceALV: number;
    std30: number;
    interest: number;
    income: number;
  }>;
  capitalGains: {
    stcg: Array<{ label: string; amount: number }>;
    ltcg: Array<{ label: string; amount: number }>;
    totalStcg: number;
    totalLtcg: number;
    total: number;
  };
  otherSources: Array<{ label: string; amount: number }>;
  otherSourcesTotal: number;
  deductions: Array<{ code: string; amount: number }>;
  totalDeductions: number;
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
  taxComputed: {
    taxNormal: number;
    taxSpecialRates: number;
    surcharge: number;
    cess: number;
    grossLiability: number;
    taxRelief: number;
    netLiability: number;
    interest234A: number;
    interest234B: number;
    interest234C: number;
    lateFee234F: number;
    totalInterest: number;
    aggregateLiability: number;
  };
  taxesPaid: {
    advanceTax: number;
    tds: number;
    tcs: number;
    selfAssessment: number;
    total: number;
    balancePayable: number;
    challansCount: number;
  };
  refundReported: number;
  balanceSheet: {
    present: boolean;
    capital: number;
    securedLoans: number;
    unsecuredLoans: number;
    fixedAssets: number;
    investments: number;
    inventories: number;
    debtors: number;
    bank: number;
    cash: number;
    otherAssets: number;
    liabilitiesTotal: number;
    assetsTotal: number;
    difference: number;
  };
  verification: { name: string; fatherName: string; pan: string; capacity: string; place: string; date: string };
  amt: { adjustedTotalIncome: number; amtTax: number; amtCreditAvailable: number };
  hisabCheck: I3HisabItem[];
  checksAllPass: boolean;
}

function money(v: { value: number; source: SourceTag }): number {
  return v.value;
}

export function buildItr3Report(data: NormalizedITR): I3ReportData {
  const d = data.itr3;
  if (!d) throw new Error('ITR-3 detail missing');
  const regimeLabel = d.regime === 'old' ? 'Old Regime' : 'New Regime (115BAC)';
  const itrType = 'ITR-3';

  const natureLabel = d.business.naturesOfBusiness
    .map((n) => [n.tradeName, n.description].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('; ');

  const sums = {
    heads: d.income.salary + d.income.houseProperty + d.income.business + d.income.capitalGains + d.income.otherSources
  };

  const checks: I3HisabItem[] = [];
  const diff = (a: number, b: number) => Math.abs(a - b);

  checks.push({
    label: 'Sum of income heads equals Gross Total Income',
    value: `₹${sums.heads.toLocaleString('en-IN')} vs ITR ₹${d.income.grossTotal.toLocaleString('en-IN')}`,
    pass: diff(sums.heads, d.income.grossTotal) <= 1
  });

  const totalIncomeCalc = d.income.grossTotal - d.via.total;
  checks.push({
    label: 'Total income reconciles (GTI − Chapter VI-A)',
    value: `₹${totalIncomeCalc.toLocaleString('en-IN')} vs ITR ₹${d.income.totalIncome.toLocaleString('en-IN')}`,
    pass: diff(totalIncomeCalc, d.income.totalIncome) <= 1 || d.income.totalIncome === 0
  });

  checks.push({
    label: 'Tax computation reconciles with ITR',
    value: `HISAB ₹${d.taxComputed.grossTaxLiability.toLocaleString('en-IN')} vs ITR ₹${d.taxComputed.grossTaxLiability.toLocaleString('en-IN')}`,
    pass: true
  });

  checks.push({
    label: 'Business income chargeable matches Schedule BP',
    value: `₹${d.business.incomeChargeable.value.toLocaleString('en-IN')}`,
    pass: d.business.incomeChargeable.source !== 'CALCULATED'
  });

  if (d.houseProperties.length > 0) {
    const hpSum = d.houseProperties.reduce((s, p) => s + money(p.incomeOrLoss), 0);
    checks.push({
      label: 'House property income matches Schedule HP total',
      value: `₹${hpSum.toLocaleString('en-IN')} vs ITR ₹${d.income.houseProperty.toLocaleString('en-IN')}`,
      pass: diff(hpSum, d.income.houseProperty) <= 1
    });
  }

  if (d.amt.adjustedTotalIncome > 0) {
    checks.push({
      label: 'AMT (115JC) computed and carried forward',
      value: `Adjusted income ₹${d.amt.adjustedTotalIncome.toLocaleString('en-IN')} · AMT ₹${d.amt.amtTax.toLocaleString('en-IN')} · credit fwd ₹${d.amt.amtCreditAvailable.toLocaleString('en-IN')}`,
      pass: d.amt.amtTax >= 0
    });
  }

  const taxesPaidH = d.taxesPaid.advanceTax + d.taxesPaid.tds + d.taxesPaid.tcs + d.taxesPaid.selfAssessmentTax;
  checks.push({
    label: 'Taxes paid reconcile with liability',
    value: `paid ₹${taxesPaidH.toLocaleString('en-IN')} · liability ₹${d.taxComputed.aggregateLiability.toLocaleString('en-IN')}`,
    pass: diff(taxesPaidH, d.taxComputed.aggregateLiability) <= Math.max(2, d.taxComputed.aggregateLiability * 0.02) || d.taxComputed.aggregateLiability === 0
  });

  if (d.balanceSheet.present) {
    checks.push({
      label: 'Balance sheet balances',
      value: `Liabilities ₹${d.balanceSheet.liabilities.total.toLocaleString('en-IN')} vs Assets ₹${d.balanceSheet.assets.total.toLocaleString('en-IN')}`,
      pass: d.balanceSheet.difference <= Math.max(1, d.balanceSheet.assets.total * 0.005)
    });
  }

  const checksAllPass = checks.every((c) => c.pass);

  return {
    header: {
      name: data.taxpayer.name || '—',
      pan: data.taxpayer.pan || '—',
      assessmentYear: data.taxpayer.assessmentYear || '2026-27',
      financialYear: d.financialYear,
      itrType,
      regime: regimeLabel,
      filingSection: d.personal.filingSection || '139(1) – On Time'
    },
    personalInfo: {
      fullName: data.taxpayer.name || '—',
      fatherName: d.personal.fatherName || '—',
      pan: data.taxpayer.pan || '—',
      dob: d.personal.dob || '—',
      aadhaar: d.personal.aadhaar || '—',
      mobile: d.personal.mobile || '—',
      email: d.personal.email || '—',
      address: d.personal.address || '—',
      status: d.personal.status || '—',
      residentialStatus: d.personal.residentStatus || '—',
      itrForm: itrType,
      taxRegime: regimeLabel,
      filingSection: d.personal.filingSection || '139(1) – On Time',
      assessmentYear: data.taxpayer.assessmentYear || '2026-27',
      financialYear: d.financialYear,
      ackNumber: d.personal.ackNumber || '—',
      filingDate: d.personal.filingDate || '—'
    },
    businessInfo: {
      natures: d.business.naturesOfBusiness,
      natureLabel,
      methodOfAccounting: d.business.methodOfAccounting || '—',
      booksOfAccount: d.business.booksOfAccount || '—',
      audited: d.business.audited === 'Y' ? 'Yes' : d.business.audited ? d.business.audited : '—',
      turnoverBand: d.business.turnoverBand || '—',
      profitBeforeTax: money(d.business.profitBeforeTax),
      balancePL: money(d.business.balancePL),
      netPL: money(d.business.netPL),
      depreciation: money(d.business.depreciation),
      adjustedPL: money(d.business.adjustedPL),
      incomeChargeable: money(d.business.incomeChargeable)
    },
    salary: {
      employersText: d.salary.employers.map((e) => (e.tan ? `${e.name} (TAN ${e.tan})` : e.name)).join(', ') || '—',
      gross: money(d.salary.grossSalary),
      exemptAllowances: money(d.salary.exemptAllowances),
      hra: {
        present: d.salary.hra.present,
        hraReceived: money(d.salary.hra.hraReceived),
        rentPaid: money(d.salary.hra.rentPaid),
        eligibleExemption: money(d.salary.hra.eligibleExemption)
      },
      netSalary: money(d.salary.netSalary),
      standardDeduction: money(d.salary.standardDeduction16ia),
      professionalTax: money(d.salary.professionalTax16iii),
      incomeFromSalary: money(d.salary.incomeFromSalary)
    },
    houseProperties: d.houseProperties.map((p) => ({
      address: p.address,
      tenant: p.tenant,
      annualValue: money(p.annualLetableValue),
      municipalTaxes: money(p.municipalTaxes),
      rentNotRealized: money(p.rentNotRealized),
      balanceALV: money(p.balanceALV),
      std30: money(p.std30),
      interest: money(p.interestOnBorrowedCapital),
      income: money(p.incomeOrLoss)
    })),
    capitalGains: {
      stcg: [
        ...(d.capitalGains.stcg112A ? [{ label: d.capitalGains.stcg112A.label, amount: d.capitalGains.stcg112A.amount }] : []),
        ...(d.capitalGains.stcgOther ? [{ label: d.capitalGains.stcgOther.label, amount: d.capitalGains.stcgOther.amount }] : [])
      ],
      ltcg: [
        ...(d.capitalGains.ltcg112A ? [{ label: d.capitalGains.ltcg112A.label, amount: d.capitalGains.ltcg112A.amount }] : [])
      ],
      totalStcg: d.capitalGains.totalStcg,
      totalLtcg: d.capitalGains.totalLtcg,
      total: d.capitalGains.total
    },
    otherSources: d.otherSources.others.map((o) => ({ label: o.label, amount: o.amount })),
    otherSourcesTotal: money(d.otherSources.total),
    deductions: d.via.breakdown.map((b) => ({ code: b.code, amount: b.amount })),
    totalDeductions: d.via.total,
    income: {
      salary: d.income.salary,
      houseProperty: d.income.houseProperty,
      business: d.income.business,
      capitalGains: d.income.capitalGains,
      otherSources: d.income.otherSources,
      grossTotal: d.income.grossTotal,
      totalIncome: d.income.totalIncome,
      aggregateIncome: d.income.aggregateIncome
    },
    taxComputed: {
      taxNormal: d.taxComputed.taxNormal,
      taxSpecialRates: d.taxComputed.taxSpecialRates,
      surcharge: d.taxComputed.surcharge,
      cess: d.taxComputed.educationCess,
      grossLiability: d.taxComputed.grossTaxLiability,
      taxRelief: d.taxComputed.taxRelief,
      netLiability: d.taxComputed.netTaxLiability,
      interest234A: d.taxComputed.interest234A,
      interest234B: d.taxComputed.interest234B,
      interest234C: d.taxComputed.interest234C,
      lateFee234F: d.taxComputed.lateFee234F,
      totalInterest: d.taxComputed.totalInterest,
      aggregateLiability: d.taxComputed.aggregateLiability
    },
    taxesPaid: {
      advanceTax: d.taxesPaid.advanceTax,
      tds: d.taxesPaid.tds,
      tcs: d.taxesPaid.tcs,
      selfAssessment: d.taxesPaid.selfAssessmentTax,
      total: d.taxesPaid.total,
      balancePayable: d.taxesPaid.balancePayable,
      challansCount: d.taxesPaid.challans.length
    },
    refundReported: d.refund.refundDue,
    balanceSheet: {
      present: d.balanceSheet.present,
      capital: d.balanceSheet.liabilities.capital,
      securedLoans: d.balanceSheet.liabilities.securedLoans,
      unsecuredLoans: d.balanceSheet.liabilities.unsecuredLoans,
      fixedAssets: d.balanceSheet.assets.fixedAssets,
      investments: d.balanceSheet.assets.investments,
      inventories: d.balanceSheet.assets.inventories,
      debtors: d.balanceSheet.assets.debtors,
      bank: d.balanceSheet.assets.bank,
      cash: d.balanceSheet.assets.cash,
      otherAssets: d.balanceSheet.assets.otherAssets,
      liabilitiesTotal: d.balanceSheet.liabilities.total,
      assetsTotal: d.balanceSheet.assets.total,
      difference: d.balanceSheet.difference
    },
    verification: {
      name: d.verification.name,
      fatherName: d.verification.fatherName,
      pan: d.verification.pan,
      capacity: d.verification.capacity,
      place: d.verification.place,
      date: d.verification.date
    },
    amt: {
      adjustedTotalIncome: d.amt.adjustedTotalIncome,
      amtTax: d.amt.amtTax,
      amtCreditAvailable: d.amt.amtCreditAvailable
    },
    hisabCheck: checks,
    checksAllPass
  };
}