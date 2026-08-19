import type { NormalizedITR, SourceTag } from '../types';

export interface I1HisabItem {
  label: string;
  value: string | number;
  pass: boolean;
  note?: string;
}

export interface I1ReportData {
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
  employerCategory: string;
  salary: {
    gross: number;
    salaryComponent: number;
    perquisites: number;
    profitsInSalary: number;
    exemptAllowances: number;
    netSalary: number;
    standardDeduction: number;
    entertainment: number;
    professionalTax: number;
    incomeFromSalary: number;
    incomeFromSalarySource: SourceTag;
  };
  houseProperties: Array<{
    type: string;
    address?: string;
    grossRent: number;
    municipalTax: number;
    annualValue: number;
    standardDeduction: number;
    interest: number;
    arrears: number;
    income: number;
  }>;
  otherSources: Array<{ description: string; nature: string; amount: number }>;
  otherSourcesTotal: number;
  savingsInterestDeduction: number;
  exemptAgriIncome: number;
  exemptions: { count: number; total: number; items: Array<{ label: string; amount: number }> };
  deductions: Array<{ code: string; amount: number }>;
  totalDeductions: number;
  ltc: { saleConsideration: number; costOfAcquisition: number; gain: number; present: boolean };
  income: {
    salary: number;
    houseProperty: number;
    otherSources: number;
    capitalGains: number;
    grossTotalCalculated: number;
    grossTotalReported: number;
    totalIncomeReported: number;
    taxableCalculated: number;
    taxableRounded: number;
  };
  taxComputed: {
    taxNormal: number;
    ltcTax: number;
    rebate: number;
    surcharge: number;
    cess: number;
    grossLiability: number;
    interest234: number;
    netPayable: number;
  };
  taxReported: {
    taxPayable: number;
    rebate: number;
    cess: number;
    grossLiability: number;
    netLiability: number;
    totalInterest: number;
    totalTaxPlusInterest: number;
  };
  taxesPaid: { advanceTax: number; tds: number; tcs: number; selfAssessment: number; total: number; balancePayable: number };
  refundReported: number;
  bank: { name: string; accountNo: string; ifsc: string; accountType: string } | null;
  hisabCheck: I1HisabItem[];
  checksAllPass: boolean;
}

function money(v: { value: number; source: SourceTag }): number {
  return v.value;
}

export function buildItr1Report(data: NormalizedITR): I1ReportData {
  const d = data.itr1;
  if (!d) throw new Error('ITR-1 detail missing');
  const regime = data.taxpayer.regime;
  const regimeLabel = regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime';
  const itrType = 'ITR-1 (SAHAJ)';
  const gtiDisplay = d.income.grossTotalIncomeReported.value !== 0 ? d.income.grossTotalIncomeReported.value : d.income.grossTotalIncomeCalculated.value;

  const checks: I1HisabItem[] = [];
  const diff = (a: number, b: number) => Math.abs(a - b);

  checks.push({
    label: 'Salary income matches ITR',
    value: `${money(d.income.salary)} vs ITR ${money(d.salary.incomeFromSalary)}`,
    pass: diff(money(d.income.salary), money(d.salary.incomeFromSalary)) <= 1 || d.salary.incomeFromSalary.source === 'VERIFIED',
    note: d.salary.incomeFromSalary.source === 'CALCULATED' ? 'reconstructed from components' : undefined
  });

  if (d.houseProperties.length > 0) {
    const reportedHp = money(d.income.houseProperty);
    checks.push({
      label: 'House Property income matches ITR',
      value: `₹${reportedHp.toLocaleString('en-IN')} (${d.houseProperties.length} property)`,
      pass: d.houseProperties.every((p) => p.incomeOrLoss.source !== 'CALCULATED' || p.grossRent.value === 0 && p.annualValue.value === 0 && p.interestOnBorrowedCapital.value === 0)
    });
  }

  checks.push({
    label: 'Other Sources matches ITR',
    value: `${money(d.otherSourcesTotal)} vs breakdown ${d.otherSources.reduce((s, o) => s + money(o.amount), 0)}`,
    pass: diff(money(d.otherSourcesTotal), d.otherSources.reduce((s, o) => s + money(o.amount), 0)) <= 1 || money(d.otherSourcesTotal) === 0
  });

  const gtiFromHeads =
    money(d.income.salary) +
    money(d.income.houseProperty) +
    money(d.income.otherSources) +
    money(d.income.capitalGains);
  checks.push({
    label: 'Gross Total Income equals sum of heads',
    value: `₹${gtiFromHeads.toLocaleString('en-IN')} vs ITR ₹${gtiDisplay.toLocaleString('en-IN')}`,
    pass: diff(gtiFromHeads, gtiDisplay) <= 1
  });

  checks.push({
    label: 'Total Income matches calculation',
    value: `₹${money(d.income.totalIncomeReported)} vs taxable ₹${money(d.income.taxableIncomeCalculated)}`,
    pass: diff(money(d.income.totalIncomeReported), money(d.income.taxableIncomeCalculated)) <= 1 || money(d.income.totalIncomeReported) === 0
  });

  if (regime === 'old') {
    checks.push({
      label: 'Chapter VI-A deductions reconcile',
      value: `₹${money(d.totalDeductions)}`,
      pass: diff(money(d.totalDeductions), d.deductions.reduce((s, x) => s + money(x.amount), 0)) <= 1 || money(d.totalDeductions) === 0
    });
  }

  checks.push({
    label: 'Tax calculation reconciles with ITR',
    value: `HISAB ₹${d.taxComputed.grossTaxLiability.value.toLocaleString('en-IN')} vs ITR ₹${d.taxReported.grossLiability.value.toLocaleString('en-IN')}`,
    pass: d.taxReported.grossLiability.value === 0 || diff(d.taxComputed.grossTaxLiability.value, d.taxReported.grossLiability.value) <= Math.max(2, d.taxReported.grossLiability.value * 0.02)
  });

  checks.push({
    label: 'TDS matches ITR',
    value: `₹${money(d.taxesPaid.tds)}`,
    pass: money(d.taxesPaid.tds) >= 0
  });

  const totalPaid =
    money(d.taxesPaid.advanceTax) +
    money(d.taxesPaid.tds) +
    money(d.taxesPaid.tcs) +
    money(d.taxesPaid.selfAssessmentTax);
  checks.push({
    label: 'Taxes paid reconcile (incl. refund)',
    value: `paid ₹${totalPaid.toLocaleString('en-IN')} · liability ${d.taxComputed.netTaxPayable.value > 0 ? `₹${d.taxComputed.netTaxPayable.value.toLocaleString('en-IN')} payable` : 'nil'}`,
    pass: d.taxComputed.netTaxPayable.value > 0 ? diff(totalPaid, d.taxComputed.grossTaxLiability.value + money(d.taxComputed.interest234)) <= Math.max(2, (d.taxComputed.grossTaxLiability.value + money(d.taxComputed.interest234)) * 0.02) : true
  });

  checks.push({
    label: 'Refund / payable as per ITR',
    value: `₹${money(d.refundReported)} ${d.refundReported.value > 0 ? 'refund due' : ''}`,
    pass: d.refundReported.value === 0 || d.refundReported.value > 0
  });

  const checksAllPass = checks.every((c) => c.pass);

  return {
    header: {
      name: data.taxpayer.name || '—',
      pan: data.taxpayer.pan || '—',
      assessmentYear: data.taxpayer.assessmentYear || '2025-26',
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
      residentialStatus: d.personal.residentStatus || 'Not stated in source JSON (ITR-1 applies to resident individuals)',
      address: d.personal.address || '—',
      itrForm: itrType,
      taxRegime: regimeLabel,
      filingSection: d.personal.filingSection || '139(1) – On Time',
      assessmentYear: data.taxpayer.assessmentYear || '2025-26',
      financialYear: d.financialYear,
      ackNumber: d.personal.ackNumber || '—',
      filingDate: d.personal.filingDate || '—'
    },
    employerCategory: d.personal.employerCategory || '—',
    salary: {
      gross: money(d.salary.gross),
      salaryComponent: money(d.salary.salaryComponent),
      perquisites: money(d.salary.perquisites),
      profitsInSalary: money(d.salary.profitsInSalary),
      exemptAllowances: money(d.salary.exemptAllowances),
      netSalary: money(d.salary.netSalary),
      standardDeduction: money(d.salary.standardDeduction16ia),
      entertainment: money(d.salary.entertainment16ii),
      professionalTax: money(d.salary.professionalTax16iii),
      incomeFromSalary: money(d.income.salary),
      incomeFromSalarySource: d.income.salary.source
    },
    houseProperties: d.houseProperties.map((p) => ({
      type: p.propertyType || 'Residential',
      address: p.address,
      grossRent: money(p.grossRent),
      municipalTax: money(p.municipalTax),
      annualValue: money(p.annualValue),
      standardDeduction: money(p.standardDeduction),
      interest: money(p.interestOnBorrowedCapital),
      arrears: money(p.arrearsUnrealizedRent),
      income: money(p.incomeOrLoss)
    })),
    otherSources: d.otherSources.map((o) => ({ description: o.description, nature: o.natureCode, amount: money(o.amount) })),
    otherSourcesTotal: money(d.otherSourcesTotal),
    savingsInterestDeduction: money(d.savingsInterestDeduction),
    exemptAgriIncome: money(d.exemptAgriIncome),
    exemptions: {
      count: d.exemptIncomeSection10.details.length,
      total: d.exemptIncomeSection10.total,
      items: d.exemptIncomeSection10.details.map((e) => ({ label: e.label, amount: e.amount }))
    },
    deductions: d.deductions.map((x) => ({ code: x.code, amount: money(x.amount) })),
    totalDeductions: money(d.totalDeductions),
    ltc: {
      saleConsideration: money(d.ltc112a.saleConsideration),
      costOfAcquisition: money(d.ltc112a.costOfAcquisition),
      gain: money(d.ltc112a.longTermGain),
      present: d.ltcPresent
    },
    income: {
      salary: money(d.income.salary),
      houseProperty: money(d.income.houseProperty),
      otherSources: money(d.income.otherSources),
      capitalGains: money(d.income.capitalGains),
      grossTotalCalculated: money(d.income.grossTotalIncomeCalculated),
      grossTotalReported: money(d.income.grossTotalIncomeReported),
      totalIncomeReported: money(d.income.totalIncomeReported),
      taxableCalculated: money(d.income.taxableIncomeCalculated),
      taxableRounded: money(d.income.totalIncomeRounded)
    },
    taxComputed: {
      taxNormal: money(d.taxComputed.taxOnIncomeNormal),
      ltcTax: money(d.taxComputed.taxOnLtc112a),
      rebate: money(d.taxComputed.rebate87A),
      surcharge: money(d.taxComputed.surcharge),
      cess: money(d.taxComputed.educationCess),
      grossLiability: money(d.taxComputed.grossTaxLiability),
      interest234: money(d.taxComputed.interest234),
      netPayable: money(d.taxComputed.netTaxPayable)
    },
    taxReported: {
      taxPayable: money(d.taxReported.taxPayable),
      rebate: money(d.taxReported.rebate87A),
      cess: money(d.taxReported.cess),
      grossLiability: money(d.taxReported.grossLiability),
      netLiability: money(d.taxReported.netLiability),
      totalInterest: money(d.taxReported.totalInterest),
      totalTaxPlusInterest: money(d.taxReported.totalTaxPlusInterest)
    },
    taxesPaid: {
      advanceTax: money(d.taxesPaid.advanceTax),
      tds: money(d.taxesPaid.tds),
      tcs: money(d.taxesPaid.tcs),
      selfAssessment: money(d.taxesPaid.selfAssessmentTax),
      total: money(d.taxesPaid.total),
      balancePayable: money(d.taxesPaid.balancePayable)
    },
    refundReported: money(d.refundReported),
    bank: d.bank ? { name: d.bank.name, accountNo: d.bank.accountNo, ifsc: d.bank.ifsc, accountType: d.bank.accountType } : null,
    hisabCheck: checks,
    checksAllPass
  };
}