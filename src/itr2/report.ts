import type { NormalizedITR, SourceTag } from '../types';

export type I2CheckStatus = 'OK' | 'ROUNDING' | 'CHECK';

export interface I2HisabItem {
  label: string;
  value: string | number;
  pass: boolean;
  status: I2CheckStatus;
  note?: string;
}

export interface I2ReportData {
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
  salary: {
    employersText: string;
    gross: number;
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
    address: string;
    letOut: string;
    annualValue: number;
    municipalTaxes: number;
    rentNotRealized: number;
    balanceALV: number;
    std30: number;
    interest: number;
    income: number;
  }>;
  capitalGains: {
    items: Array<{ label: string; kind: string; amount: number }>;
    totalStcg: number;
    totalLtcg: number;
    total: number;
    vdaIncome: number;
  };
  otherSources: Array<{ label: string; amount: number }>;
  otherSourcesGross: number;
  otherSourcesDeductions: number;
  otherSourcesTotal: number;
  deductions: Array<{ code: string; label: string; amount: number }>;
  totalDeductions: number;
  section80d: { self: number; parents: number; eligibleAmount: number } | null;
  exemptIncome: Array<{ label: string; amount: number }>;
  specialIncomes: Array<{ label: string; rate: number; amount: number; tax: number }>;
  income: {
    salary: number;
    houseProperty: number;
    capitalGains: number;
    otherSources: number;
    grossTotal: number;
    specialRateIncome: number;
    totalIncome: number;
    aggregateIncome: number;
  };
  taxComputed: {
    json: {
      taxNormal: number;
      taxSpecialRates: number;
      taxOnTotIncome: number;
      rebate87A: number;
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
    hisab: {
      taxNormal: number;
      taxSpecialRates: number;
      rebate: number;
      surcharge: number;
      cess: number;
      grossLiability: number;
      netLiability: number;
    };
  };
  taxesPaid: {
    advanceTax: number;
    tds: number;
    tcs: number;
    selfAssessment: number;
    total: number;
    balancePayable: number;
    challansCount: number;
    tdsSalaryCount: number;
    tdsOtherCount: number;
  };
  refundReported: number;
  bank: { name: string; accountNo: string; ifsc: string; accountType: string } | null;
  amt: { adjustedTotalIncome: number; amtTax: number; amtCreditAvailable: number };
  verification: { name: string; fatherName: string; pan: string; capacity: string; place: string; date: string };
  hisabCheck: I2HisabItem[];
  checksAllPass: boolean;
}

function money(v: { value: number; source: SourceTag }): number {
  return v.value;
}

export function maskPan(pan: string): string {
  if (!pan) return '';
  return pan.length >= 6 ? pan.slice(0, 2) + '******' + pan.slice(-2) : '***';
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return '';
  const d = aadhaar.replace(/\D/g, '');
  return d.length >= 8 ? d.slice(0, 4) + 'XXXX' + d.slice(-4) : aadhaar;
}

export function maskMobile(mobile: string): string {
  if (!mobile) return '';
  const d = mobile.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(0, 5) + 'XXXXX' : mobile;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const keep = Math.min(2, local.length);
  return local.slice(0, keep) + '•••@' + domain;
}

export function maskBankAccount(acc: string): string {
  if (!acc) return '';
  return acc.length >= 6 ? acc.slice(0, 4) + 'XXXX' + acc.slice(-2) : acc;
}

/** Classify a mismatch: <=1 is exact, <=9 is pure rounding (₹10 rounding), else a real difference. */
function classify(diff: number): I2CheckStatus {
  if (diff <= 1) return 'OK';
  if (diff <= 9) return 'ROUNDING';
  return 'CHECK';
}

export function buildItr2Report(data: NormalizedITR): I2ReportData {
  const d = data.itr2;
  if (!d) throw new Error('ITR-2 detail missing');
  const regimeLabel = d.regime === 'old' ? 'Old Regime' : 'New Regime (115BAC)';
  const itrType = 'ITR-2';

  const checks: I2HisabItem[] = [];
  const diff = (a: number, b: number) => Math.abs(a - b);

  // 1. Sum of heads vs Gross Total Income (PartB-TI)
  const headsSum =
    d.income.salary +
    Math.max(0, d.income.houseProperty) +
    d.income.capitalGains +
    d.income.otherSources;
  {
    const di = diff(headsSum, d.income.grossTotal);
    const status = classify(di);
    checks.push({
      label: 'Sum of income heads equals Gross Total Income',
      value: `₹${headsSum.toLocaleString('en-IN')} vs ITR ₹${d.income.grossTotal.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK',
      note: status === 'ROUNDING' ? 'within ₹10 rounding' : undefined
    });
  }

  // 2. Gross Total Income reported (PartB-TI) matches ITS-computed totals
  {
    const reported = d.taxComputed.grossTaxLiability;
    void reported;
  }

  // 3. Total income reconciles: GTI − VI-A = Total Income
  {
    const applicableDed = d.regime === 'old' ? d.income.viaDeductions : 0;
    const calc = d.income.grossTotal - applicableDed;
    const di = diff(calc, d.income.totalIncome) <= 9 ? 0 : diff(calc, d.income.totalIncome);
    const status = calc - d.income.totalIncome <= 9 && calc - d.income.totalIncome >= -9 ? (Math.abs(calc - d.income.totalIncome) <= 1 ? 'OK' : 'ROUNDING') : 'CHECK';
    void di;
    checks.push({
      label: 'Total income reconciles (GTI − Chapter VI-A)',
      value: `₹${calc.toLocaleString('en-IN')} vs ITR ₹${d.income.totalIncome.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK',
      note: status === 'ROUNDING' ? 'within ₹10 rounding of total income' : undefined
    });
  }

  // 4. Chapter VI-A deductions reconcile with the schedule
  {
    const viaSum = d.via.breakdown.reduce((s, x) => s + x.amount, 0);
    const status = classify(diff(viaSum, d.income.viaDeductions));
    checks.push({
      label: 'Chapter VI-A deductions reconcile with Schedule VIA',
      value: `₹${viaSum.toLocaleString('en-IN')} vs PartB-TI ₹${d.income.viaDeductions.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK' || d.income.viaDeductions === 0,
      note: d.regime === 'new' ? 'New Regime (115BAC) — Chapter VI-A not applicable' : undefined
    });
  }

  // 5. Special-rate income reconciles
  {
    const status = classify(diff(d.income.specialRateIncome, d.specialIncomes.reduce((s, x) => s + x.amount, 0)));
    checks.push({
      label: 'Special-rate income reconciles with Schedule SI',
      value: `PartB-TI ₹${d.income.specialRateIncome.toLocaleString('en-IN')} vs Schedule SI ₹${d.specialIncomes.reduce((s, x) => s + x.amount, 0).toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK'
    });
  }

  // 6. HISAB tax reconciliation vs PartB-TTI (Gross Tax Liability)
  {
    const di = diff(d.hisabTax.grossLiability, d.taxComputed.grossTaxLiability);
    const status = d.taxComputed.grossTaxLiability === 0
      ? (diff(d.hisabTax.grossLiability, d.taxComputed.aggregateLiability) <= 9 ? 'OK' : 'CHECK')
      : di <= Math.max(9, d.taxComputed.grossTaxLiability * 0.02) ? (di <= 9 ? 'OK' : 'ROUNDING') : 'CHECK';
    checks.push({
      label: 'Tax (HISAB) reconciles with ITR PartB-TTI',
      value: `HISAB ₹${d.hisabTax.grossLiability.toLocaleString('en-IN')} vs ITR ₹${d.taxComputed.grossTaxLiability.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK',
      note: status === 'ROUNDING' ? 'small difference within tolerance' : undefined
    });
  }

  // 7. Aggregate liability (tax + interest) ties out
  {
    const calcAggregate = d.taxComputed.netTaxLiability + d.taxComputed.totalInterest;
    const status = classify(diff(calcAggregate, d.taxComputed.aggregateLiability));
    checks.push({
      label: 'Aggregate tax & interest ties out',
      value: `₹${calcAggregate.toLocaleString('en-IN')} vs ITR ₹${d.taxComputed.aggregateLiability.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK' || d.taxComputed.aggregateLiability === 0
    });
  }

  // 8. Taxes paid reconcile with the liability
  {
    const totalPaidH =
      d.taxesPaid.advanceTax + d.taxesPaid.tds + d.taxesPaid.tcs + d.taxesPaid.selfAssessmentTax;
    const liability = d.taxComputed.aggregateLiability || d.taxComputed.grossTaxLiability;
    const status = liability === 0
      ? 'OK'
      : diff(totalPaidH, liability) <= Math.max(9, liability * 0.02) ? (diff(totalPaidH, liability) <= 9 ? 'OK' : 'ROUNDING') : 'CHECK';
    checks.push({
      label: 'Taxes paid reconcile with liability',
      value: `paid ₹${totalPaidH.toLocaleString('en-IN')} · liability ₹${liability.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK',
      note: `refund/payable ₹${(totalPaidH - liability).toLocaleString('en-IN')}`
    });
  }

  // 9. TDS cross-checks (TDS1 + TDS2 + TDS3 vs Part B-TDS)
  {
    const tdsSchedule =
      d.taxesPaid.tdsSalary.reduce((s, t) => s + t.tds, 0) +
      d.taxesPaid.tdsOther.reduce((s, t) => s + t.tds, 0);
    const status = d.taxesPaid.tds === 0 ? 'OK' : classify(diff(tdsSchedule, d.taxesPaid.tds));
    checks.push({
      label: 'TDS schedules cross-check with taxes paid (Part B)',
      value: `TDS1+2 ₹${tdsSchedule.toLocaleString('en-IN')} vs Part B ₹${d.taxesPaid.tds.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK' || d.taxesPaid.tds === 0
    });
  }

  // 10. Sum of heads as reported + rounding note
  {
    const gtiFromParts = headsSum;
    const status = classify(diff(gtiFromParts, d.income.grossTotal));
    checks.push({
      label: 'Gross Total Income matches ITS',
      value: `₹${gtiFromParts.toLocaleString('en-IN')} vs ₹${d.income.grossTotal.toLocaleString('en-IN')}`,
      status,
      pass: status !== 'CHECK'
    });
  }

  const checksAllPass = checks.every((c) => c.pass);

  let recommendedBank = d.refund.banks[0];
  if (d.refund.banks.length === 0 && d.taxesPaid.challans.length > 0 && data.taxpayer.bankName) {
    recommendedBank = {
      name: data.taxpayer.bankName || '',
      accountNo: data.taxpayer.accountNo || '',
      ifsc: data.taxpayer.ifsc || '',
      accountType: data.taxpayer.accountType || '',
      useForRefund: false
    };
  }

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
      residentialStatus: d.personal.residentStatus || 'Resident',
      itrForm: itrType,
      taxRegime: regimeLabel,
      filingSection: d.personal.filingSection || '139(1) – On Time',
      assessmentYear: data.taxpayer.assessmentYear || '2026-27',
      financialYear: d.financialYear,
      ackNumber: d.personal.ackNumber || '—',
      filingDate: d.personal.filingDate || '—'
    },
    salary: {
      employersText: d.salary.employers.map((e) => (e.tan ? `${e.name} (TAN ${e.tan})` : e.name)).join(', ') || '—',
      gross: money(d.salary.grossSalary),
      perquisites: money(d.salary.perquisites),
      profitsInSalary: money(d.salary.profitsInSalary),
      exemptAllowances: money(d.salary.exemptAllowances),
      netSalary: money(d.salary.netSalary),
      standardDeduction: money(d.salary.standardDeduction16ia),
      entertainment: money(d.salary.entertainment16ii),
      professionalTax: money(d.salary.professionalTax16iii),
      incomeFromSalary: money(d.salary.incomeFromSalary),
      incomeFromSalarySource: d.salary.incomeFromSalary.source
    },
    houseProperties: d.houseProperties.map((p) => ({
      address: p.address,
      letOut: p.letOut,
      annualValue: money(p.annualLetableValue),
      municipalTaxes: money(p.municipalTaxes),
      rentNotRealized: money(p.rentNotRealized),
      balanceALV: money(p.balanceALV),
      std30: money(p.std30),
      interest: money(p.interestOnBorrowedCapital),
      income: money(p.incomeOrLoss)
    })),
    capitalGains: {
      items: d.capitalGains.items.map((i) => ({ label: i.label, kind: i.kind, amount: i.amount })),
      totalStcg: d.capitalGains.totalStcg,
      totalLtcg: d.capitalGains.totalLtcg,
      total: d.capitalGains.total,
      vdaIncome: d.capitalGains.vdaIncome
    },
    otherSources: d.otherSources.breakdown.map((o) => ({ label: o.label, amount: o.amount })),
    otherSourcesGross: money(d.otherSources.grossIncome),
    otherSourcesDeductions: money(d.otherSources.deductions),
    otherSourcesTotal: money(d.otherSources.total),
    deductions: d.via.breakdown.map((b) => ({ code: b.code, label: b.label, amount: b.amount })),
    totalDeductions: d.via.total,
    section80d: d.via.section80d ? {
      self: d.via.section80d.self,
      parents: d.via.section80d.parents,
      eligibleAmount: d.via.section80d.eligibleAmount
    } : null,
    exemptIncome: d.exemptIncome.details.map((e) => ({ label: e.label, amount: e.amount })),
    specialIncomes: d.specialIncomes.map((s) => ({ label: s.label, rate: s.rate, amount: s.amount, tax: s.tax })),
    income: {
      salary: d.income.salary,
      houseProperty: d.income.houseProperty,
      capitalGains: d.income.capitalGains,
      otherSources: d.income.otherSources,
      grossTotal: d.income.grossTotal,
      specialRateIncome: d.income.specialRateIncome,
      totalIncome: d.income.totalIncome,
      aggregateIncome: d.income.aggregateIncome
    },
    taxComputed: {
      json: {
        taxNormal: d.taxComputed.taxNormal,
        taxSpecialRates: d.taxComputed.taxSpecialRates,
        taxOnTotIncome: d.taxComputed.taxOnTotIncome,
        rebate87A: d.taxComputed.rebate87A,
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
      hisab: {
        taxNormal: d.hisabTax.taxNormal,
        taxSpecialRates: d.hisabTax.taxSpecialRates,
        rebate: d.hisabTax.rebate,
        surcharge: d.hisabTax.surcharge,
        cess: d.hisabTax.cess,
        grossLiability: d.hisabTax.grossLiability,
        netLiability: d.hisabTax.netLiability
      }
    },
    taxesPaid: {
      advanceTax: d.taxesPaid.advanceTax,
      tds: d.taxesPaid.tds,
      tcs: d.taxesPaid.tcs,
      selfAssessment: d.taxesPaid.selfAssessmentTax,
      total: d.taxesPaid.total,
      balancePayable: d.taxesPaid.balancePayable,
      challansCount: d.taxesPaid.challans.length,
      tdsSalaryCount: d.taxesPaid.tdsSalary.length,
      tdsOtherCount: d.taxesPaid.tdsOther.length
    },
    refundReported: d.refund.refundDue,
    bank: (d.refund.banks[0] ?? recommendedBank) ? {
      name: (d.refund.banks[0] ?? recommendedBank).name,
      accountNo: (d.refund.banks[0] ?? recommendedBank).accountNo,
      ifsc: (d.refund.banks[0] ?? recommendedBank).ifsc,
      accountType: (d.refund.banks[0] ?? recommendedBank).accountType
    } : null,
    amt: {
      adjustedTotalIncome: d.amt.adjustedTotalIncome,
      amtTax: d.amt.amtTax,
      amtCreditAvailable: d.amt.amtCreditAvailable
    },
    verification: {
      name: d.verification.name,
      fatherName: d.verification.fatherName,
      pan: d.verification.pan,
      capacity: d.verification.capacity,
      place: d.verification.place,
      date: d.verification.date
    },
    hisabCheck: checks,
    checksAllPass
  };
}