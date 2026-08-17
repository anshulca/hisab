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

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

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

function pickFromList(objects: Array<Record<string, unknown> | undefined>, keys: string[]): number {
  for (const obj of objects) {
    const value = pick(obj, keys);
    if (value !== 0) return value;
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

  /* ---------------- Personal Info ---------------- */
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

  /* ---------------- Assessment Year ---------------- */
  const formItr4 = (itr4.Form_ITR4 ?? {}) as Record<string, unknown>;
  const ayEnd = parseInt(String(formItr4.AssessmentYear ?? personalInfo.AssessmentYear ?? ''), 10);
  let assessmentYear = String(personalInfo.AssessmentYear ?? '2024-25');
  let financialYear = String(personalInfo.FinancialYear ?? '2023-24');
  if (Number.isFinite(ayEnd) && ayEnd >= 2015 && ayEnd <= 2040) {
    assessmentYear = `${ayEnd - 1}-${String(ayEnd).slice(2)}`;
    financialYear = `${ayEnd - 2}-${String(ayEnd - 1).slice(2)}`;
  }

  /* ---------------- Regime ---------------- */
  const filingStatus = (itr4.FilingStatus ?? {}) as Record<string, unknown>;
  let regime: 'new' | 'old' = 'old';
  const optedOut = String(filingStatus.OptOutNewTaxRegime_Form10IEA_AY24_25 ?? '').toUpperCase();
  const noOptOut = String(filingStatus.No_OptOutNewTaxReg ?? '').toUpperCase();
  if (optedOut === 'Y') regime = 'old';
  else if (noOptOut === 'Y' || optedOut === 'N') regime = 'new';

  /* ---------------- Income & Schedules ---------------- */
  const incomeDeductions = (itr4.IncomeDeductions ?? {}) as Record<string, unknown>;
  // Official ITR-4 JSON keeps ScheduleBP at ITR4 level; support legacy location too.
  const scheduleBP = ((itr4.ScheduleBP as Record<string, unknown>) ??
    (incomeDeductions.ScheduleBP as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  const presumptive44ad = (scheduleBP.PersumptiveInc44AD ?? {}) as Record<string, unknown>;
  const presumptive44ada = (scheduleBP.PersumptiveInc44ADA ?? {}) as Record<string, unknown>;
  const presumptive44ae = (scheduleBP.PersumptiveInc44AE ?? {}) as Record<string, unknown>;

  const businessIncome = pickFromList(
    [incomeDeductions, presumptive44ad, presumptive44ada, presumptive44ae],
    [
      'IncomeFromBusinessProf', 'TotalBusinessIncome', 'TotPersumptiveInc44AD', 'TotPersumptiveInc44ADA',
      'TotPersumptiveInc44AE', 'TotPersumptiveInc', 'TotalPresumptiveIncome', 'PersumptiveInc44AD',
      'TotalIncome', 'BusinessIncome', 'TotalPGBP', 'TotPGBP'
    ]
  );

  const adaIncome = pick(presumptive44ada, ['TotPersumptiveInc44ADA', 'TotalIncome', 'PresumptiveIncome']);
  const profession = adaIncome > 0 ? 'Presumptive Professional (44ADA)' : 'Presumptive Business (44AD)';
  const taxpayerType = adaIncome > 0 ? 'professional' : 'business';

  const turnover = pickFromList(
    [presumptive44ad, presumptive44ada, presumptive44ae, scheduleBP],
    [
      'GrsTotalTrnOver', 'GrsTotalTrnOverInCash', 'TotalTurnoverGrsRcptGSTIN', 'TurnoverGrsRcptForGSTIN',
      'GrossTotalTurnOver', 'TotalTurnOver', 'GrsTotTrnOver', 'GrossTurnOver', 'TotalTurnover',
      'Turnover', 'GrossReceipts'
    ]
  );

  const otherSources = pickFromList(
    [incomeDeductions],
    ['IncomeOthSrc', 'TotalOtherIncome', 'OtherIncome', 'TotalOtherSrc', 'OtherSourceTotal', 'GrossOtherSources', 'TotalOtherSources', 'IncomeFromOtherSources']
  );

  const ltc112a = (itr4.LTCG112A ?? {}) as Record<string, unknown>;
  const capitalGains = pickFromList(
    [ltc112a, incomeDeductions],
    ['LongCap112A', 'TotCptlGain', 'TotalCapitalGain', 'CptlGain', 'GrossCptlGain', 'TotalCG', 'CapitalGain']
  );

  const otherIncomeList = ((incomeDeductions.OthersInc as Record<string, unknown>)?.OthersIncDtlsOthSrc ?? []) as Array<Record<string, unknown>>;

  /* ---------------- Tax computation block ---------------- */
  const taxComp = (itr4.TaxComputation ?? {}) as Record<string, unknown>;
  const officialTotalIncome = pickFromList(
    [incomeDeductions, taxComp],
    ['TotalIncome', 'GrossTotIncome', 'GrossTotalIncome', 'TotalGrossIncome']
  );
  const officialNetLiability = pick(taxComp, ['NetTaxLiability', 'NetTaxPayable', 'TotalTaxPayable', 'TotalTax']);

  const linkedIncome = businessIncome + capitalGains + otherSources;
  const totalIncome = linkedIncome > 0 ? linkedIncome : officialTotalIncome;

  if (linkedIncome === 0) {
    issues.push({
      path: 'IncomeDeductions',
      message: 'Income could not be mapped from the expected ITR-4 keys; using official TaxComputation.TotalIncome as fallback. This file may use a different schema (BETA).',
      severity: 'warning'
    });
  }

  /* ---------------- Taxes paid & refund ---------------- */
  const taxPaid = (itr4.TaxPaid ?? {}) as Record<string, unknown>;
  const taxesPaid = (taxPaid.TaxesPaid ?? {}) as Record<string, unknown>;
  const tdsTotal = pickFromList([taxesPaid, taxPaid], ['TDS', 'TotalTDS', 'Tds', 'TDSDeducted', 'TotalTDSDeducted']);
  const advanceTax = pickFromList([taxesPaid, taxPaid], ['AdvanceTax', 'TotalAdvanceTax', 'AdvTax']);
  const selfAssessmentTax = pickFromList([taxesPaid, taxPaid], ['SelfAssessmentTax', 'TotalSelfAssessmentTax']);

  const refund = (itr4.Refund ?? {}) as Record<string, unknown>;
  const refundDue = pick(refund, ['RefundDue', 'Refund']);

  /* ---------------- Chapter VI-A deductions ---------------- */
  const via = (incomeDeductions.UsrDeductUndChapVIA ?? incomeDeductions.DeductUndChapVIA ?? {}) as Record<string, unknown>;
  const viaCodes: Array<[string, string]> = [
    ['Section80C', '80C'], ['Section80CCC', '80CCC'], ['Section80CCDEmployeeOrSE', '80CCD(1)'],
    ['Section80CCD1B', '80CCD(1B)'], ['Section80CCDEmployer', '80CCD(2)'], ['Section80D', '80D'],
    ['Section80DD', '80DD'], ['Section80DDB', '80DDB'], ['Section80E', '80E'], ['Section80EE', '80EE'],
    ['Section80EEA', '80EEA'], ['Section80EEB', '80EEB'], ['Section80G', '80G'], ['Section80GG', '80GG'],
    ['Section80GGC', '80GGC'], ['Section80U', '80U'], ['Section80TTA', '80TTA'], ['Section80TTB', '80TTB'],
    ['AnyOthSec80CCH', '80CCH']
  ];
  const deductions: DeductionItem[] = [];
  for (const [key, code] of viaCodes) {
    const amount = parseNumber((via as Record<string, unknown>)[key]);
    if (amount > 0) deductions.push({ code, label: code, amount, section: code });
  }
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

  /* ---------------- Balance sheet ---------------- */
  const finances = (scheduleBP.FinanclPartclrOfBusiness ?? {}) as Record<string, unknown>;
  const balanceSheet = {
    partnerCapital: pick(finances, ['PartnerMemberOwnCapital', 'PartnerOrMemberCapital']),
    securedLoans: pick(finances, ['SecuredLoans']),
    unsecuredLoans: pick(finances, ['UnSecuredLoans']),
    advances: pick(finances, ['Advances', 'LoanAndAdvances']),
    sundryCreditors: pick(finances, ['SundryCreditors']),
    otherCurrentLiab: pick(finances, ['OthrCurrLiab', 'OtherCurrentLiabilities']),
    capitalLiabilities: pick(finances, ['TotCapLiabilities', 'TotalCapLiabilities']),
    fixedAssets: pick(finances, ['FixedAssets']),
    inventories: pick(finances, ['Inventories', 'Inventory']),
    sundryDebtors: pick(finances, ['SundryDebtors']),
    bankBalances: pick(finances, ['BalWithBanks', 'BalanceWithBanks']),
    cashInHand: pick(finances, ['CashInHand']),
    loansAndAdvances: pick(finances, ['LoansAndAdvances']),
    otherAssets: pick(finances, ['OtherAssets']),
    totalAssets: pick(finances, ['TotalAssets'])
  };

  /* ---------------- Tax computation ---------------- */
  const manualTax = computeRealRegimeTax(totalIncome, regime, regime === 'old' ? totalDeductions : 0);

  const taxComputation = {
    regime,
    grossTotalIncome: totalIncome,
    deductions,
    totalDeductions: regime === 'old' ? totalDeductions : 0,
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

  /* ---------------- Reconciliation ---------------- */
  const profitMargin = turnover > 0 ? (businessIncome / turnover) * 100 : 0;
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
    summary: { turnover, profitDeclared: businessIncome, profitMargin, marginAlert },
    tdsReconciliation: { totalClaimed: tdsTotal, tdsRatio, tdsAlert },
    taxComparison: {
      officialTaxLiability: officialNetLiability,
      manualRecalculatedLiability: manualTax.totalPayable,
      expectedRefund,
      refundAsPerReturn: refundDue,
      dispute
    }
  };

  /* ---------------- Income source rows ---------------- */
  const sourceRows: IncomeSource[] = [
    {
      code: 'PGBP',
      label: profession,
      amount: businessIncome,
      percentage: totalIncome ? (businessIncome / totalIncome) * 100 : 0
    },
    {
      code: 'CG',
      label: 'Capital Gains (112A)',
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

  for (const detail of otherIncomeList.slice(0, 10)) {
    const amount = parseNumber(detail.OthSrcOthAmount);
    if (amount > 0) {
      sourceRows.push({
        code: 'OSD',
        label: String(detail.OthSrcOthNatOfInc ?? detail.OthSrcNatureDesc ?? 'Other Income'),
        amount,
        percentage: 0
      });
    }
  }

  if (sourceRows.length === 0 && totalIncome > 0) {
    sourceRows.push({
      code: 'GTI',
      label: 'Income as per ITR (not split into heads)',
      amount: totalIncome,
      percentage: 100
    });
  }

  /* ---------------- Taxpayer ---------------- */
  const businessName = (scheduleBP.NatOfBus44AD as Record<string, unknown> | undefined)?.NameOfBusiness;
  const taxpayer: Taxpayer = {
    name,
    pan,
    assessmentYear,
    financialYear,
    type: taxpayerType,
    regime,
    city: String(address.CityOrTownOrDistrict ?? address.City ?? '').split(',')[0].trim(),
    state: STATE_CODES[String(address.StateCode ?? '').trim()] ?? '',
    pinCode: String(address.PinCode ?? address.PINCode ?? ''),
    profession
  };

  /* ---------------- Report sections ---------------- */
  const reportSections: ReportSection[] = [
    {
      id: 'cover',
      title: 'Cover Page',
      summary: 'Taxpayer details extracted from the ITR-4 JSON.',
      details: [
        { label: 'Name', value: taxpayer.name },
        { label: 'Business', value: String(businessName ?? '') || '—' },
        { label: 'PAN', value: taxpayer.pan },
        { label: 'Assessment Year', value: taxpayer.assessmentYear },
        { label: 'Financial Year', value: taxpayer.financialYear },
        { label: 'Tax Regime', value: regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime' },
        { label: 'City', value: taxpayer.city || '—' },
        { label: 'State', value: taxpayer.state || '—' },
        { label: 'PIN Code', value: taxpayer.pinCode || '—' }
      ]
    },
    {
      id: 'income',
      title: 'Income Summary',
      summary: `Gross total income of ₹${totalIncome.toLocaleString('en-IN')} for AY ${taxpayer.assessmentYear}.`,
      details: [
        { label: 'Gross Turnover (44AD)', value: turnover },
        { label: 'Presumptive Business Income', value: businessIncome },
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
        { label: 'Fixed Assets', value: balanceSheet.fixedAssets },
        { label: 'Inventories', value: balanceSheet.inventories },
        { label: 'Sundry Debtors', value: balanceSheet.sundryDebtors },
        { label: 'Bank Balances', value: balanceSheet.bankBalances },
        { label: 'Cash in Hand', value: balanceSheet.cashInHand },
        { label: 'Loans & Advances', value: balanceSheet.loansAndAdvances },
        { label: 'Other Assets', value: balanceSheet.otherAssets },
        { label: 'Total Assets', value: balanceSheet.totalAssets },
        { label: 'Partner Capital', value: balanceSheet.partnerCapital },
        { label: 'Secured Loans', value: balanceSheet.securedLoans },
        { label: 'Unsecured Loans', value: balanceSheet.unsecuredLoans },
        { label: 'Sundry Creditors', value: balanceSheet.sundryCreditors },
        { label: 'Capital & Liabilities', value: balanceSheet.capitalLiabilities }
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
        { label: 'Self-Assessment Tax', value: selfAssessmentTax },
        { label: 'Net Tax Payable', value: taxComputation.netTaxPayable }
      ]
    }
  ];

  if (linkedIncome === 0) {
    reportSections.push({
      id: 'parsing',
      title: 'Parsing Note (BETA)',
      summary: 'Income heads could not be mapped from the expected ITR-4 keys, so HISAB used the official TaxComputation.TotalIncome. Sharing the detected keys below with the developer will fix the split.',
      details: [
        { label: 'IncomeDeductions keys', value: Object.keys(incomeDeductions).slice(0, 16).join(', ') || '—' },
        { label: 'ScheduleBP keys', value: Object.keys(scheduleBP).slice(0, 16).join(', ') || '—' },
        { label: 'TaxComputation keys', value: Object.keys(taxComp).slice(0, 16).join(', ') || '—' },
        { label: 'TaxesPaid keys', value: Object.keys(taxesPaid).slice(0, 16).join(', ') || '—' },
        { label: 'Gross Total Income used', value: totalIncome },
        { label: 'TDS detected', value: tdsTotal },
        { label: 'Regime detected', value: regime === 'new' ? 'New (115BAC)' : 'Old' }
      ]
    });
  }

  const normalized: NormalizedITR = {
    taxpayer,
    incomeBreakdown: {
      businessIncome,
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
