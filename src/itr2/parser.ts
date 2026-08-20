import type {
  IncomeSource,
  Itr2BankDetail,
  Itr2CapGainItem,
  Itr2Challan,
  Itr2Detail,
  Itr2Employer,
  Itr2HouseProperty,
  Itr2LossHead,
  Itr2OtherSourceItem,
  Itr2Salary,
  Itr2SpecialIncome,
  Itr2TdsOther,
  Itr2TdsSalary,
  NormalizedITR,
  ReportSection,
  SourceTag,
  Taxpayer,
  Valued,
  ValidationIssue
} from '../types';
import { getAYSlabSet } from '../calculation/taxEngine';
import { parseNumber } from '../utils/currency';

const STATE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

const RESIDENT_MAP: Record<string, string> = {
  RES: 'Resident',
  RNOR: 'Resident but Not Ordinarily Resident',
  NRI: 'Non-Resident (NRI)',
  NOR: 'Not Ordinarily Resident'
};

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
}

function num(x: unknown): number {
  return Math.round(parseNumber(x));
}

function vJSON(x: unknown): Valued {
  return { value: num(x), source: 'JSON' };
}

function pick(rec: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') return rec[k];
  }
  return undefined;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface Itr2ParseResult {
  normalized: NormalizedITR;
  issues: ValidationIssue[];
}

/* ============================================================
   ITR-2 tax recomputation — AY 2024-25 & AY 2026-27
   ITR-2 has no business income. Normal slab tax applies on the
   "aggregate income" (Total Income minus special-rate income),
   special incomes (STCG 111A, LTCG 112A, etc.) are taxed at their
   special rates, then health & education cess @4%.
   ============================================================ */

export interface Itr2TaxResult {
  taxNormal: number;
  taxSpecialRates: number;
  rebate: number;
  surcharge: number;
  cess: number;
  grossLiability: number;
  netLiability: number;
  aggregateLiability: number;
}

export function computeItr2Tax(opts: {
  totalIncome: number;
  specialRateIncome: number;
  specialRateTax: number;
  regime: 'new' | 'old';
  assessmentYear: string;
}): Itr2TaxResult {
  const { totalIncome, specialRateIncome, specialRateTax, regime, assessmentYear } = opts;
  const slabs = getAYSlabSet(assessmentYear);

  const aggregate = Math.max(0, totalIncome - specialRateIncome);
  const taxableAggregate = Math.floor(aggregate / 10) * 10;

  const slabList = regime === 'new' ? slabs.newRegime : slabs.oldRegime;
  let taxNormal = 0;
  let prev = 0;
  let remaining = taxableAggregate;
  for (const s of slabList) {
    const inSlab = Math.min(Math.max(0, remaining), s.upTo - prev);
    taxNormal += inSlab * s.rate;
    remaining -= inSlab;
    prev = s.upTo;
    if (remaining <= 0) break;
  }
  taxNormal = Math.round(taxNormal);

  let rebate = 0;
  if (regime === 'new') {
    if (totalIncome <= slabs.newRebate.threshold) rebate = Math.min(taxNormal + specialRateTax, slabs.newRebate.amount);
  } else if (totalIncome <= slabs.oldRebate.threshold) {
    rebate = Math.min(taxNormal + specialRateTax, slabs.oldRebate.amount);
  }
  rebate = Math.round(rebate);

  const taxBeforeCess = Math.max(0, taxNormal + specialRateTax - rebate);
  const surcharge = Math.round(taxBeforeCess * (totalIncome > 5000000 ? 0.1 : 0));
  const cess = Math.round((taxBeforeCess + surcharge) * 0.04);
  const grossLiability = taxBeforeCess + surcharge + cess;

  return {
    taxNormal,
    taxSpecialRates: specialRateTax,
    rebate,
    surcharge,
    cess,
    grossLiability,
    netLiability: grossLiability,
    aggregateLiability: grossLiability
  };
}

/* ============================================================
   Parser
   ============================================================ */

export function parseItr2(raw: string): Itr2ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(raw).trim());
  } catch {
    throw new Error(
      'This file could not be read as JSON. Please upload the ITR export from the e-filing portal (expected structure: { "ITR": { "ITR2": { ... } } }).'
    );
  }
  return parseItr2Object(data);
}

export function parseItr2Object(input: unknown): Itr2ParseResult {
  const issues: ValidationIssue[] = [];
  const root = obj(input);
  const itr = obj(root.ITR);
  const itr2 = obj(itr.ITR2);
  if (!itr.ITR2) {
    throw new Error('This file is not an ITR-2 export.');
  }

  const formItr2 = obj(itr2.Form_ITR2);
  const gen1 = obj(itr2.PartA_GEN1);
  const personalInfo = obj(gen1.PersonalInfo);
  const assesseeName = obj(personalInfo.AssesseeName);
  const address = obj(personalInfo.Address);
  const filingStatus = obj(gen1.FilingStatus);
  const verification = obj(itr2.Verification);
  const declaration = obj(verification.Declaration);
  const creationInfo = obj(itr2.CreationInfo);

  const firstName = String(assesseeName.FirstName ?? '');
  const middleName = String(assesseeName.MiddleName ?? '');
  const surName = String(assesseeName.SurNameOrOrgName ?? assesseeName.Name ?? '');
  const name = `${firstName} ${middleName} ${surName}`.replace(/\s+/g, ' ').trim() || 'Unknown Taxpayer';
  const pan = String(personalInfo.PAN ?? declaration.AssesseeVerPAN ?? 'ABCDE1234F').toUpperCase();

  /* ---------- Assessment / financial years ----------
     The utility encodes AssessmentYear as the FIRST year of the AY
     (e.g. "2026" -> AY 2026-27, FY 2025-26). Schedule AMTC's
     CurrAssYr (e.g. "2026-27") is authoritative when present. */
  const amtcCurrAssYr = String(obj(itr2.ScheduleAMTC).CurrAssYr ?? '').trim();
  const ayRaw = pick(formItr2, ['AssessmentYear']) ?? personalInfo.AssessmentYear;
  const ayNum = num(ayRaw);
  let assessmentYear = '2026-27';
  let financialYear = '2025-26';
  if (/^\d{4}-\d{4}$/.test(amtcCurrAssYr)) {
    assessmentYear = amtcCurrAssYr;
    const first = parseInt(amtcCurrAssYr.slice(0, 4), 10);
    financialYear = `${first - 1}-${String(first).slice(2)}`;
  } else if (Number.isFinite(ayNum) && ayNum >= 2015 && ayNum <= 2040) {
    assessmentYear = `${ayNum}-${String(ayNum + 1).slice(2)}`;
    financialYear = `${ayNum - 1}-${String(ayNum).slice(2)}`;
  } else if (typeof ayRaw === 'string' && /^\d{4}-\d{4}$/.test(ayRaw)) {
    assessmentYear = ayRaw;
    const first = parseInt(ayRaw.slice(0, 4), 10);
    financialYear = `${first - 1}-${ayRaw.slice(5)}`;
  }

  /* ---------- Regime ---------- */
  const optedOut = String(filingStatus.OptOutNewTaxRegime ?? '').toUpperCase();
  const regime: 'new' | 'old' = optedOut === 'Y' ? 'old' : 'new';

  const stateCodeKey = String(address.StateCode ?? '').trim().padStart(2, '0');
  const stateName = STATE_MAP[stateCodeKey] ?? STATE_MAP[stateCodeKey.slice(1)] ?? '';
  const addressParts = [
    String(address.ResidenceNo ?? ''),
    String(address.ResidenceName ?? ''),
    String(address.RoadOrStreet ?? ''),
    String(address.LocalityOrArea ?? ''),
    String(address.CityOrTownOrDistrict ?? ''),
    stateName,
    String(address.PinCode ?? address.PINCode ?? '')
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
  const mobileRaw = String(address.MobileNo ?? '');
  const ackNumber = String(personalInfo.AckNumber ?? formItr2.AckNumber ?? '') || '—';
  const filingDate = String(creationInfo.JSONCreationDate ?? personalInfo.FilingDate ?? '') || '—';
  const retFileSec = num(filingStatus.ReturnFileSec);
  const filingSection = retFileSec === 11 ? '139(1) – On Time' : retFileSec > 0 ? `139(${retFileSec === 4 ? '4' : '1'})` : '';

  /* ---------- Salary (Schedule S) ---------- */
  const schedS = obj(itr2.ScheduleS);
  const salariesRaw = Array.isArray(schedS.Salaries) ? (schedS.Salaries as Array<Record<string, unknown>>) : [];
  const employers: Itr2Employer[] = salariesRaw.map((s) => {
    const addr = obj(s.AddressDetail);
    const addDetail = {
      name: String(s.NameOfEmployer ?? ''),
      tan: String(s.TANofEmployer ?? ''),
      natureOfEmployment: String(s.NatureOfEmployment ?? ''),
      address: [
        String(addr.AddrDetail ?? ''),
        String(addr.CityOrTownOrDistrict ?? ''),
        String(addr.PinCode ?? '')
      ].filter(Boolean).join(', ')
    };
    return addDetail;
  });
  const grossSalary = vJSON(pick(schedS, ['TotalGrossSalary']));
  const perquisites = vJSON(salariesRaw.reduce((s, e) => s + num(obj(e.Salarys).ValueOfPerquisites), 0));
  const profitsInSalary = vJSON(salariesRaw.reduce((s, e) => s + num(obj(e.Salarys).ProfitsinLieuOfSalary), 0));
  const exemptAllowances = vJSON(pick(schedS, ['AllwncExtentExemptUs10', 'TotalAllwncExemptUs10']));
  const netSalary = vJSON(schedS.NetSalary);
  const stdDed16ia = vJSON(pick(schedS, ['DeductionUS16', 'DeductionUnderSection16ia', 'DeductionUs16']));
  const entertain16ii = vJSON(schedS.EntertainmntalwncUs16ii);
  const profTax16iii = vJSON(schedS.ProfessionalTaxUs16iii);
  const reportedSal = num(schedS.TotIncUnderHeadSalaries);
  const salaryCalc = Math.max(0, grossSalary.value - exemptAllowances.value - stdDed16ia.value - entertain16ii.value - profTax16iii.value);
  const incomeFromSalary: Valued = {
    value: reportedSal !== 0 ? reportedSal : salaryCalc,
    source: reportedSal !== 0 && Math.abs(reportedSal - salaryCalc) <= 1 ? 'VERIFIED' : reportedSal !== 0 ? 'JSON' : 'CALCULATED'
  };
  const salary: Itr2Salary = {
    employers,
    grossSalary,
    salaryComponent: vJSON(pick(schedS, ['TotalGrossSalary'])),
    perquisites,
    profitsInSalary,
    exemptAllowances,
    netSalary,
    standardDeduction16ia: stdDed16ia,
    entertainment16ii: entertain16ii,
    professionalTax16iii: profTax16iii,
    incomeFromSalary
  };

  /* ---------- House property (Schedule HP) ---------- */
  const schedHP = obj(itr2.ScheduleHP);
  const hpProps = Array.isArray(schedHP.PropertyDetails) ? (schedHP.PropertyDetails as Array<Record<string, unknown>>) : [];
  const houseProperties: Itr2HouseProperty[] = hpProps.map((p) => {
    const addr = obj(p.AddressDetailWithZipCode ?? p.AddressDetail);
    const rent = obj(p.Rentdetails);
    return {
      propertyNo: num(p.HPSNo ?? p.HPNo),
      address: [
        String(addr.AddrDetail ?? ''),
        String(addr.CityOrTownOrDistrict ?? ''),
        String(addr.PinCode ?? '')
      ].filter(Boolean).join(', '),
      owner: String(p.PropertyOwner ?? ''),
      letOut: String(p.ifLetOut ?? ''),
      annualLetableValue: vJSON(rent.AnnualLetableValue),
      rentNotRealized: vJSON(rent.RentNotRealized),
      municipalTaxes: vJSON(rent.LocalTaxes),
      balanceALV: vJSON(rent.BalanceALV),
      std30: vJSON(rent.ThirtyPercentOfBalance),
      interestOnBorrowedCapital: vJSON(pick(rent, ['IntOnBorwCap', 'InterestPayable'])),
      arrearsUnrealizedRent: vJSON(rent.ArrearsUnrealizedRentRcvd),
      incomeOrLoss: vJSON(rent.IncomeOfHP ?? p.TotalIncomeOfHP)
    };
  });
  const incomeFromHP = num(schedHP.TotalIncomeChargeableUnHP) || houseProperties.reduce((s, p) => s + p.incomeOrLoss.value, 0);

  /* ---------- Capital gains (Schedule CG For 23 / 112A / 115AD / VDA) ---------- */
  const cg = buildCapitalGains(itr2);

  /* ---------- Other sources (Schedule OS) ---------- */
  const schedOS = obj(itr2.ScheduleOS);
  const osNode = obj(schedOS.IncOthThanOwnRaceHorse);
  const grossInc = num(osNode.GrossIncChrgblTaxAtAppRate);
  const dividend = num(osNode.DividendGross);
  const savingsInt = num(osNode.IntrstFrmSavingBank);
  const otherInt = num(osNode.IntrstFrmOthers) + num(osNode.IntrstFrmIncmTaxRefund) + num(osNode.IntrstFrmTermDeposit);
  const anyOther = num(osNode.AnyOtherIncome);
  const othersInc = Array.isArray(obj(osNode.OthersInc).OthersIncDtls)
    ? (obj(osNode.OthersInc).OthersIncDtls as Array<Record<string, unknown>>)
    : [];
  const deductions = num(obj(osNode.Deductions).TotDeductions) || num(obj(osNode.Deductions).Expenses);
  const osTotalReported = num(schedOS.TotOthSrcNoRaceHorse) || num(schedOS.IncChargeable) || num(osNode.BalanceNoRaceHorse);

  const breakdown: Itr2OtherSourceItem[] = [];
  if (dividend) breakdown.push({ label: 'Dividend income', amount: dividend });
  if (savingsInt) breakdown.push({ label: 'Interest from savings bank account', amount: savingsInt });
  if (otherInt) breakdown.push({ label: 'Other interest income', amount: otherInt });
  for (const o of othersInc) {
    const amt = num(o.OthAmount);
    if (amt) breakdown.push({ label: String(o.OthNatOfInc ?? 'Other income'), amount: amt });
  }
  if (anyOther && !breakdown.some((b) => b.amount === anyOther)) breakdown.push({ label: 'Any other income', amount: anyOther });

  const otherSources = {
    grossIncome: { value: grossInc, source: (grossInc !== 0 ? 'JSON' : 'CALCULATED') as SourceTag },
    dividend,
    savingsInterest: savingsInt,
    otherInterest: otherInt,
    deductions: { value: deductions, source: (deductions !== 0 ? 'JSON' : 'CALCULATED') as SourceTag },
    breakdown,
    total: {
      value: osTotalReported !== 0 ? osTotalReported : grossInc - deductions,
      source: (osTotalReported !== 0 ? 'JSON' : 'CALCULATED') as SourceTag
    }
  };
  if (osTotalReported === 0 && grossInc > 0) {
    issues.push({ path: 'ScheduleOS', message: 'Other sources income reconstructed (balance not reported) — shown in HISAB Check.', severity: 'warning' });
  }

  /* ---------- CYLA / BFLA ---------- */
  const cyla = buildItr2LossHeads(itr2.ScheduleCYLA, 'IncOfCurYrUnderThatHead', 'IncOfCurYrAfterSetOff');
  const bfla = buildItr2LossHeads(itr2.ScheduleBFLA, 'IncOfCurYrUndHeadFromCYLA', 'IncOfCurYrAfterSetOffBFLosses');

  /* ---------- Schedule CFL (carried forward summary) ---------- */
  const schedCFL = obj(itr2.ScheduleCFL);
  const cflSummary = obj(obj(schedCFL.TotalLossCFSummary).LossSummaryDetail);
  const cfl = {
    hpLoss: num(cflSummary.TotalHPPTILossCF),
    stcgLoss: num(cflSummary.TotalSTCGPTILossCF),
    ltcgLoss: num(cflSummary.TotalLTCGPTILossCF),
    raceHorseLoss: num(cflSummary.OthSrcLossRaceHorseCF)
  };

  /* ---------- Chapter VI-A + Schedule 80D ---------- */
  const schedVIA = obj(itr2.ScheduleVIA);
  const via = buildVia2(schedVIA, itr2.Schedule80D);

  /* ---------- Exempt income (Schedule EI) ---------- */
  const schedEI = obj(itr2.ScheduleEI);
  const exemptIncome = {
    total: num(schedEI.TotalExemptInc ?? schedEI.NetAgriIncOrOthrIncRule7),
    details: [] as Array<{ label: string; amount: number }>
  };
  const exemptDetRows: Array<[string, string]> = [
    ['Net agricultural income (Rule 7)', 'NetAgriIncOrOthrIncRule7'],
    ['Exempt income — retained for rate purposes', 'IncNotChrgblToTax'],
    ['Exempt income from pass-through', 'PassThrIncNotChrgblTax'],
    ['Other exempt income', 'Others']
  ];
  for (const [label, key] of exemptDetRows) {
    const amt = num(schedEI[key]);
    if (amt) exemptIncome.details.push({ label, amount: amt });
  }
  if (num(schedEI.GrossAgriRecpt) > 0) exemptIncome.details.push({ label: 'Gross agricultural receipts', amount: num(schedEI.GrossAgriRecpt) });

  /* ---------- AMT / AMTC ---------- */
  const schedAMT = obj(itr2.ScheduleAMT);
  const schedAMTC = obj(itr2.ScheduleAMTC);
  const amtCarried = Array.isArray(schedAMTC.ScheduleAMTCDtls)
    ? (schedAMTC.ScheduleAMTCDtls as Array<Record<string, unknown>>)
    : [];
  const amt = {
    adjustedTotalIncome: num(pick(schedAMT, ['AdjustedUnderSec115JC', 'TotalIncItemPartBTI'])) || num(schedAMTC.TotalIncItemPartBTI),
    amtTax: num(pick(schedAMTC, ['TaxOthProvisions', 'TaxPayableUnderSec115JC'])),
    amtCreditAvailable: num(schedAMTC.AmtTaxCreditAvailable),
    amtCreditCarriedForward: amtCarried.map((a) => ({ year: String(a.AssYr ?? ''), credit: num(a.BalAmtCreditCarryFwd) }))
  };

  /* ---------- Special income (Schedule SI) ---------- */
  const schedSI = obj(itr2.ScheduleSI);
  const siRows = Array.isArray(schedSI.SplCodeRateTax)
    ? (schedSI.SplCodeRateTax as Array<Record<string, unknown>>)
    : [];
  const specialIncomes: Itr2SpecialIncome[] = siRows
    .map((s) => {
      const code = String(s.SecCode ?? '');
      const amount = num(s.SplRateInc);
      const rate = num(s.SplRatePercent);
      const jsonTax = num(s.SplRateIncTax);
      const computed = rate > 0 ? Math.round((amount * rate) / 100) : 0;
      const tax = jsonTax !== 0 && (computed === 0 || Math.abs(jsonTax - computed) <= Math.max(2, computed * 0.01)) ? jsonTax : computed;
      return { code, label: specialRateLabel(code), rate, amount, tax };
    })
    .filter((s) => s.amount !== 0);
  const specialRateTotal = num(schedSI.TotSplRateInc) || specialIncomes.reduce((s, x) => s + x.amount, 0);
  const specialRateTaxTotal = num(schedSI.TotSplRateIncTax) || specialIncomes.reduce((s, x) => s + x.tax, 0);

  /* ---------- Foreign tax relief (Schedule TR1) ---------- */
  const schedTR1 = obj(itr2.ScheduleTR1);
  const foreignTaxRelief = {
    taxPaidOutsideIndia: num(schedTR1.TotalTaxPaidOutsideIndia),
    taxReliefOutsideIndia: num(schedTR1.TotalTaxReliefOutsideIndia)
  };

  /* ---------- Income aggregation (PartB-TI) ---------- */
  const partBTI = obj(itr2['PartB-TI']);
  const capGainRaw = obj(partBTI.CapGain);
  const osHead = obj(partBTI.IncFromOS);

  const salaryHead = num(partBTI.Salaries) !== 0 ? num(partBTI.Salaries) : incomeFromSalary.value;
  const hpHead = num(partBTI.IncomeFromHP) !== 0 ? num(partBTI.IncomeFromHP) : incomeFromHP;
  const cgHead = num(pick(capGainRaw, ['TotalCapGains', 'ShortTermLongTermTotal'])) !== 0
    ? num(pick(capGainRaw, ['TotalCapGains', 'ShortTermLongTermTotal']))
    : cg.total;
  const osHeadInc = num(pick(osHead, ['TotIncFromOS', 'IncChargblSplRate'])) !== 0
    ? num(pick(osHead, ['TotIncFromOS', 'IncChargblSplRate']))
    : otherSources.total.value;
  const grossTotal = num(partBTI.GrossTotalIncome) || (salaryHead + Math.max(0, hpHead) + cgHead + osHeadInc);
  const viaDeductions = num(partBTI.DeductionsUnderScheduleVIA);
  const totalIncome = num(partBTI.TotalIncome) || Math.max(0, grossTotal - (regime === 'old' ? viaDeductions : 0));
  const specialRateIncome = num(partBTI.IncChargeableTaxSplRates) || specialRateTotal;
  const aggregateIncome = num(partBTI.AggregateIncome) || Math.max(0, totalIncome - specialRateIncome);

  const income = {
    salary: salaryHead,
    houseProperty: hpHead,
    capitalGains: cgHead,
    otherSources: osHeadInc,
    grossTotal,
    specialRateIncome,
    viaDeductions,
    totalIncome,
    aggregateIncome
  };

  /* ---------- Tax computation (PartB_TTI) ---------- */
  const partBTTI = obj(itr2.PartB_TTI);
  const taxCompRaw = obj(partBTTI.ComputationOfTaxLiability);
  const taxOnTI = obj(taxCompRaw.TaxPayableOnTI);
  const taxRelief = obj(taxCompRaw.TaxRelief);
  const intrstRaw = obj(taxCompRaw.IntrstPay);
  const taxPaidRaw = obj(partBTTI.TaxPaid);
  const taxesPaidObj = obj(taxPaidRaw.TaxesPaid);
  const refundRaw = obj(partBTTI.Refund);

  const taxComputed = {
    taxNormal: num(taxOnTI.TaxAtNormalRatesOnAggrInc) || num(taxOnTI.TaxPayableOnTotInc),
    taxSpecialRates: num(taxOnTI.TaxAtSpecialRates),
    taxOnTotIncome: num(taxOnTI.TaxPayableOnTotInc),
    rebate87A: num(taxCompRaw.Rebet87A) || num(taxOnTI.Repate87ARatediff),
    surcharge: num(pick(taxCompRaw, ['TotalSurcharge', 'SurchargeOnAboveCrore'])),
    educationCess: num(pick(taxCompRaw, ['EducationCess'])),
    grossTaxLiability: num(taxCompRaw.GrossTaxLiability) || num(taxCompRaw.GrossTaxPayable),
    taxRelief: num(taxRelief.TotTaxRelief) || num(taxOnTI.RebateOnAgriInc),
    netTaxLiability: num(taxCompRaw.NetTaxLiability) || num(taxCompRaw.TaxPayAfterCreditUs115JD),
    interest234A: num(intrstRaw.IntrstPayUs234A),
    interest234B: num(intrstRaw.IntrstPayUs234B),
    interest234C: num(intrstRaw.IntrstPayUs234C),
    lateFee234F: num(intrstRaw.LateFilingFee234F),
    totalInterest: num(intrstRaw.TotalIntrstPay) || (num(intrstRaw.IntrstPayUs234A) + num(intrstRaw.IntrstPayUs234B) + num(intrstRaw.IntrstPayUs234C)),
    aggregateLiability: num(pick(taxCompRaw, ['AggregateTaxInterestLiability', 'NetTaxLiability', 'GrossTaxPayable']))
  };

  const hisabTax = computeItr2Tax({
    totalIncome: totalIncome !== 0 ? totalIncome : grossTotal,
    specialRateIncome,
    specialRateTax: specialRateTaxTotal,
    regime,
    assessmentYear
  });

  /* ---------- Taxes paid (Schedule IT / TDS1 / TDS2 / TDS3 / TCS) ---------- */
  const schedIT = obj(itr2.ScheduleIT);
  const challanRows = Array.isArray(schedIT.TaxPayment) ? (schedIT.TaxPayment as Array<Record<string, unknown>>) : [];
  const challans: Itr2Challan[] = challanRows.map((c) => ({
    bsrCode: String(c.BSRCode ?? ''),
    date: String(c.DateDep ?? ''),
    cino: String(c.SrlNoOfChaln ?? ''),
    amount: num(c.Amt)
  }));

  const schedTDS1 = obj(itr2.ScheduleTDS1);
  const tds1Rows = Array.isArray(schedTDS1.TDSonSalary) ? (schedTDS1.TDSonSalary as Array<Record<string, unknown>>) : [];
  const tdsSalary: Itr2TdsSalary[] = tds1Rows.map((t) => {
    const emp = obj(t.EmployerOrDeductorOrCollectDetl);
    return {
      name: String(emp.EmployerOrDeductorOrCollecterName ?? ''),
      tan: String(emp.TAN ?? ''),
      income: num(pick(t, ['IncChrgSal', 'TotIncUnderHeadSalaries'])),
      tds: num(pick(t, ['TotalTDSSal', 'TaxDeducted']))
    };
  });

  const schedTDS2 = obj(itr2.ScheduleTDS2);
  const tds2Rows = Array.isArray(schedTDS2.TDSOthThanSalaryDtls) ? (schedTDS2.TDSOthThanSalaryDtls as Array<Record<string, unknown>>) : [];
  const tdsOther: Itr2TdsOther[] = tds2Rows.map((t) => {
    const cred = obj(t.TaxDeductCreditDtls);
    return {
      tan: String(t.TANOfDeductor ?? ''),
      section: String(t.TDSSection ?? ''),
      grossAmount: num(t.GrossAmount),
      tds: num(cred.TaxClaimedOwnHands ?? t.TaxClaimedOwnHands),
      head: String(t.HeadOfIncome ?? '')
    };
  });

  const schedTDS3 = obj(itr2.ScheduleTDS3);
  const schedTCS = obj(itr2.ScheduleTCS);

  const advanceTax = num(taxesPaidObj.AdvanceTax);
  const tds = num(taxesPaidObj.TDS) || (num(schedTDS1.TotalTDSonSalaries) + num(schedTDS2.TotalTDSonOthThanSals) + num(schedTDS3.TotalTDS3OnOthThanSal));
  const tcs = num(taxesPaidObj.TCS) || num(schedTCS.TotalSchTCS);
  const selfAssessment = num(taxesPaidObj.SelfAssessmentTax);
  const totalPaid = num(taxesPaidObj.TotalTaxesPaid) || (advanceTax + tds + tcs + selfAssessment);
  const balancePayable = num(taxPaidRaw.BalTaxPayable);

  /* ---------- Refund / bank ---------- */
  const bankRows = Array.isArray(obj(refundRaw.BankAccountDtls).AddtnlBankDetails)
    ? (obj(refundRaw.BankAccountDtls).AddtnlBankDetails as Array<Record<string, unknown>>)
    : [];
  const banks: Itr2BankDetail[] = bankRows.map((b) => ({
    name: String(b.BankName ?? ''),
    accountNo: String(b.BankAccountNo ?? ''),
    ifsc: String(b.IFSCCode ?? ''),
    accountType: String(b.AccountType ?? ''),
    useForRefund: String(b.UseForRefund ?? '').toLowerCase() === 'true'
  }));
  const refundRawHasDue = refundRaw.RefundDue !== undefined && refundRaw.RefundDue !== null && String(refundRaw.RefundDue).trim() !== '';
  const refundDue = refundRawHasDue
    ? num(refundRaw.RefundDue)
    : (totalPaid > 0 ? Math.max(0, totalPaid - (taxComputed.aggregateLiability || taxComputed.grossTaxLiability)) : 0);
  const refund = { refundDue, banks };

  /* ---------- Verification ---------- */
  const verificationDetail = {
    name: String(declaration.AssesseeVerName ?? name),
    fatherName: String(declaration.FatherName ?? '').replace(/\s+/g, ' ').trim(),
    pan: String(declaration.AssesseeVerPAN ?? pan),
    capacity: String(verification.Capacity ?? ''),
    date: String(verification.Date ?? '') || filingDate,
    place: String(verification.Place ?? '')
  };

  /* ---------- Assemble detail ---------- */
  const detail: Itr2Detail = {
    form: 'ITR2',
    assessmentYear,
    financialYear,
    regime,
    personal: {
      name,
      pan,
      fatherName: verificationDetail.fatherName,
      dob: String(personalInfo.DOB ?? ''),
      aadhaar: String(personalInfo.AadhaarCardNo ?? ''),
      mobile: mobileRaw ? (mobileRaw.startsWith('+') ? mobileRaw : `+91-${mobileRaw}`) : '',
      email: String(address.EmailAddress ?? ''),
      address: fullAddress,
      city: String(address.CityOrTownOrDistrict ?? '').split(',')[0].trim(),
      state: stateName,
      pinCode: String(address.PinCode ?? address.PINCode ?? ''),
      status: String(personalInfo.Status ?? ''),
      residentStatus: String(filingStatus.ResidentialStatus ?? ''),
      filingSection,
      returnFileSec: retFileSec,
      ackNumber,
      filingDate
    },
    salary,
    houseProperties,
    capitalGains: cg,
    otherSources,
    cyla,
    bfla,
    cfl,
    via,
    exemptIncome,
    amt,
    specialIncomes,
    foreignTaxRelief,
    income,
    taxComputed,
    hisabTax,
    taxesPaid: {
      advanceTax,
      tds,
      tcs,
      selfAssessmentTax: selfAssessment,
      total: totalPaid,
      balancePayable,
      challans,
      tdsSalary,
      tdsOther
    },
    refund,
    verification: verificationDetail
  };

  /* ---------- Issues ---------- */
  if (!personalInfo.PAN) issues.push({ path: 'PartA_GEN1.PersonalInfo.PAN', message: 'PAN missing from JSON.', severity: 'warning' });
  if (incomeFromSalary.source === 'CALCULATED' && grossSalary.value > 0) {
    issues.push({ path: 'ScheduleS.TotIncUnderHeadSalaries', message: 'Income from salary reconstructed from components (computed value differs from reported).', severity: 'warning' });
  }
  if (grossTotal > 0 && Math.abs(grossTotal - (salaryHead + Math.max(0, hpHead) + cgHead + osHeadInc)) > 1) {
    issues.push({ path: 'PartB-TI.GrossTotalIncome', message: 'Gross total income does not equal the sum of income heads — shown in HISAB Check.', severity: 'warning' });
  }
  if (regime === 'new' && viaDeductions > 0) {
    issues.push({ path: 'PartB-TI.DeductionsUnderScheduleVIA', message: 'Chapter VI-A deductions reported but taxpayer is in the New Regime (115BAC omitted).', severity: 'warning' });
  }

  /* ---------- Taxpayer ---------- */
  const taxpayer: Taxpayer = {
    name,
    pan,
    assessmentYear,
    financialYear,
    type: 'other',
    regime,
    city: detail.personal.city,
    state: stateName,
    pinCode: detail.personal.pinCode,
    fatherName: detail.personal.fatherName,
    dob: detail.personal.dob,
    aadhaar: detail.personal.aadhaar,
    mobile: detail.personal.mobile,
    email: detail.personal.email,
    residentStatus: RESIDENT_MAP[detail.personal.residentStatus] ?? detail.personal.residentStatus,
    filingSection,
    address: fullAddress,
    bankName: banks.find((b) => b.useForRefund)?.name || banks[0]?.name || '',
    accountNo: banks.find((b) => b.useForRefund)?.accountNo || banks[0]?.accountNo || '',
    ifsc: banks.find((b) => b.useForRefund)?.ifsc || banks[0]?.ifsc || '',
    accountType: banks.find((b) => b.useForRefund)?.accountType || banks[0]?.accountType || '',
    refundDue: refund.refundDue
  };

  const sourceRows: IncomeSource[] = [
    { code: 'SAL', label: 'Income from Salary', amount: salaryHead, percentage: 0 },
    { code: 'HP', label: 'Income from House Property', amount: Math.max(0, hpHead), percentage: 0 },
    { code: 'CG', label: 'Capital Gains', amount: cgHead, percentage: 0 },
    { code: 'OS', label: 'Income from Other Sources', amount: osHeadInc, percentage: 0 }
  ].filter((s) => s.amount !== 0);
  sourceRows.forEach((s) => { s.percentage = grossTotal > 0 ? (s.amount / grossTotal) * 100 : 0; });

  const taxComputation = {
    regime,
    grossTotalIncome: grossTotal,
    deductions: via.breakdown.map((d) => ({ code: d.code, label: d.label, amount: d.amount, section: d.code })),
    totalDeductions: income.viaDeductions,
    taxableIncome: totalIncome,
    taxBeforeCess: Math.max(0, hisabTax.taxNormal + hisabTax.taxSpecialRates - hisabTax.rebate),
    surcharge: hisabTax.surcharge,
    healthCess: hisabTax.cess,
    rebate: hisabTax.rebate,
    totalTax: hisabTax.grossLiability,
    advanceTax,
    tds,
    selfAssessmentTax: selfAssessment,
    netTaxPayable: Math.max(0, totalPaid - (taxComputed.aggregateLiability || hisabTax.grossLiability)),
    effectiveRate: grossTotal > 0 ? (hisabTax.grossLiability / grossTotal) * 100 : 0
  };

  const normalized: NormalizedITR = {
    taxpayer,
    itrForm: 'ITR2',
    itr2: detail,
    incomeBreakdown: {
      businessIncome: 0,
      capitalGains: cgHead,
      otherSources: osHeadInc,
      total: grossTotal,
      grossReceipts: 0,
      sources: sourceRows as Array<{ code: string; label: string; amount: number; percentage: number }>
    },
    expenseSummary: { total: 0, items: [] },
    depreciation: { totalDepreciation: 0, assets: [] },
    taxComputation,
    reportSections: buildItr2ReportSections(detail),
    computedAt: new Date().toISOString()
  };

  return { normalized, issues };
}

/* ============================================================
   Helpers
   ============================================================ */

function buildCapitalGains(itr2: Record<string, unknown>): Itr2Detail['capitalGains'] {
  const cg23 = obj(itr2.ScheduleCGFor23);
  const stcg23 = obj(cg23.ShortTermCapGainFor23);
  const ltcg23 = obj(cg23.LongTermCapGain23);
  const sched112A = obj(itr2.Schedule112A);
  const sched115AD = obj(itr2.Schedule115AD);
  const schedVDA = obj(itr2.ScheduleVDA);

  const items: Itr2CapGainItem[] = [];

  const stcgFromDtls = (_src: Record<string, unknown>, dtlsOrSelf: Record<string, unknown>, label: string, rate?: string): Itr2CapGainItem | null => {
    const d = obj(dtlsOrSelf);
    const amount = num(pick(d, ['BalanceCG', 'CapgainonAssets']));
    const consideration = num(pick(d, ['FullConsideration', 'FullValueConsdOthUnqshr']));
    if (amount === 0 && consideration === 0 && Object.keys(d).length === 0) return null;
    const cost = num(pick(obj(d.DeductSec48), ['AquisitCost'])) || num(d.AquisitCost);
    const exp = num(pick(obj(d.DeductSec48), ['ExpOnTrans', 'TotalDedn'])) || num(d.ExpOnTrans);
    items.push({ label, kind: 'STCG', rate, fullConsideration: consideration, cost, expenses: exp, amount: amount === 0 ? consideration : amount });
    return null;
  };

  const equity = Array.isArray(stcg23.EquityMFonSTT) ? (stcg23.EquityMFonSTT as Array<Record<string, unknown>>) : [];
  for (const e of equity) {
    const code = String(e.MFSectionCode ?? '');
    const label = code.toUpperCase().includes('1A') ? 'STCG — sale of listed equity u/s 111A' : `STCG — u/s ${code}`;
    if (num(obj(e.EquityMFonSTTDtls).BalanceCG) !== 0 || num(obj(e.EquityMFonSTTDtls).CapgainonAssets) !== 0) {
      stcgFromDtls(e, obj(e.EquityMFonSTTDtls), label, '111A');
    }
  }
  const saleOther = obj(stcg23.SaleOnOtherAssets);
  if (num(saleOther.BalanceCG) !== 0 || num(saleOther.CapgainonAssets) !== 0) {
    stcgFromDtls(saleOther, saleOther, 'STCG — other assets', 'AppRs');
  }
  const nri115AD = obj(stcg23.NRISecur115AD);
  if (num(nri115AD.BalanceCG) !== 0 || num(nri115AD.CapgainonAssets) !== 0) {
    stcgFromDtls(nri115AD, nri115AD, 'STCG — NRI securities u/s 115AD', '115AD');
  }

  const eq112A = obj(ltcg23.SaleOfEquityShareUs112A);
  const bal112A = num(eq112A.BalanceCG) || num(sched112A.TotalBalance112A) || num(sched112A.Balance112A);
  if (bal112A !== 0) {
    items.push({
      label: 'LTCG — sale of listed equity u/s 112A',
      kind: 'LTCG',
      rate: '112A',
      fullConsideration: num(sched112A.SaleValue112A) || num(eq112A.FullConsideration),
      cost: num(sched112A.AcquisitionCost112A),
      expenses: num(sched112A.ExpExclCnctTransfer112A),
      amount: bal112A
    });
  }
  const bal115AD = num(sched115AD.TotalBalance115AD) || num(sched115AD.Balance115AD);
  if (bal115AD !== 0) {
    items.push({
      label: 'LTCG — foreign securities u/s 115AD',
      kind: 'LTCG',
      rate: '115AD',
      fullConsideration: num(sched115AD.SaleValue115AD),
      cost: num(sched115AD.AcquisitionCost115AD),
      expenses: num(sched115AD.ExpExclCnctTransfer115AD),
      amount: bal115AD
    });
  }

  const vdaIncome = num(cg23.IncmFromVDATrnsf) || num(schedVDA.TotIncCapGain);
  if (vdaIncome !== 0) {
    items.push({
      label: 'Income from transfer of Virtual Digital Assets (u/s 115BBH)',
      kind: 'LTCG',
      rate: '115BBH',
      fullConsideration: 0,
      cost: 0,
      expenses: 0,
      amount: vdaIncome
    });
  }

  const totalStcg = items.filter((i) => i.kind === 'STCG').reduce((s, i) => s + i.amount, 0);
  const totalLtcg = items.filter((i) => i.kind === 'LTCG').reduce((s, i) => s + i.amount, 0);

  return {
    items,
    totalStcg,
    totalLtcg,
    total: totalStcg + totalLtcg,
    vdaIncome
  };
}

function buildItr2LossHeads(sched: unknown, incKey: string, afterKey: string): Itr2LossHead[] {
  const s = obj(sched);
  const map: Array<[string, string]> = [
    ['Salary', 'Salary'],
    ['HP', 'House Property'],
    ['STCG15Per', 'STCG @15%'],
    ['STCG20Per', 'STCG @20%'],
    ['STCG30Per', 'STCG @30%'],
    ['STCGAppRate', 'STCG — applicable rate'],
    ['STCGDTAARate', 'STCG — DTAA'],
    ['LTCG10Per', 'LTCG @10%'],
    ['LTCG12_5Per', 'LTCG @12.5%'],
    ['LTCG20Per', 'LTCG @20%'],
    ['LTCGDTAARate', 'LTCG — DTAA'],
    ['OthSrcExclRaceHorse', 'Other sources (excl. race horse)'],
    ['OthSrcRaceHorse', 'Other sources (race horse)'],
    ['IncOSDTAA', 'Other sources — DTAA']
  ];
  const heads: Itr2LossHead[] = [];
  for (const [key, label] of map) {
    const node = obj(s[key]);
    const cylaNode = obj(node.IncCYLA);
    const bflaNode = obj(node.IncBFLA);
    const active = Object.keys(cylaNode).length ? cylaNode : bflaNode;
    const incomeCurrent = num(pick(active, [incKey]));
    const afterSetOff = num(pick(active, [afterKey]));
    if (incomeCurrent !== 0 || afterSetOff !== 0) {
      heads.push({ head: label, incomeCurrent, afterSetOff });
    }
  }
  return heads;
}

function buildVia2(schedVIA: Record<string, unknown>, sched80DRaw: unknown): Itr2Detail['via'] {
  const usr = obj(schedVIA.UsrDeductUndChapVIA);
  const ded = obj(schedVIA.DeductUndChapVIA);
  const merged = { ...ded, ...usr };

  const breakdown: Array<{ code: string; label: string; amount: number }> = [];
  const map: Array<[string, string]> = [
    ['Section80C', '80C'], ['Section80CCC', '80CCC'], ['Section80CCDEmployeeOrSE', '80CCD(1)'],
    ['Section80CCD1B', '80CCD(1B)'], ['Section80CCDEmployer', '80CCD(2)'], ['Section80D', '80D'],
    ['Section80DD', '80DD'], ['Section80DDB', '80DDB'], ['Section80E', '80E'], ['Section80EE', '80EE'],
    ['Section80EEA', '80EEA'], ['Section80EEB', '80EEB'], ['Section80G', '80G'], ['Section80GG', '80GG'],
    ['Section80GGA', '80GGA'], ['Section80GGC', '80GGC'], ['Section80RRB', '80RRB'], ['Section80QQB', '80QQB'],
    ['Section80U', '80U'], ['Section80TTA', '80TTA'], ['Section80TTB', '80TTB'], ['AnyOthSec80CCH', '80CCH']
  ];
  for (const [key, code] of map) {
    const amount = num(merged[key]);
    if (amount > 0) breakdown.push({ code, label: `Deduction u/s ${code}`, amount });
  }
  const total = num(merged.TotalChapVIADeductions) || breakdown.reduce((s, b) => s + b.amount, 0);

  const s80D = obj(sched80DRaw);
  const h = obj(s80D.Sec80DSelfFamSrCtznHealth);
  let section80d: Itr2Detail['via']['section80d'] = null;
  if (Object.keys(h).length > 0) {
    section80d = {
      self: num(h.HealthInsPremSlfFam) || num(h.SelfAndFamily),
      parents: num(h.PrevHlthChckUpParents) || num(h.Parents),
      seniorCitizenSelf: num(h.SelfAndFamilySeniorCitizen),
      seniorCitizenParents: num(h.ParentsSeniorCitizen),
      eligibleAmount: num(h.EligibleAmountOfDedn) || breakdown.find((b) => b.code === '80D')?.amount || 0
    };
  }

  return { breakdown, total, section80d };
}

function specialRateLabel(code: string): string {
  const trimmed = String(code).trim().toUpperCase();
  const map: Record<string, string> = {
    '111A': 'Short-term capital gains u/s 111A',
    '112A': 'Long-term capital gains u/s 112A',
    '115ADA': 'Tax on foreign company dividends u/s 115AD',
    '115AD': 'Income on foreign securities u/s 115AD',
    '115BBDA': 'Dividend income u/s 115BBDA',
    '115BBJ': 'Casino / online gaming income u/s 115BBJ',
    '115BBE': 'Undisclosed income u/s 115BBE',
    '115BBH': 'Virtual digital asset income u/s 115BBH'
  };
  return map[trimmed] ?? (trimmed ? `Special-rate income u/s ${trimmed}` : 'Special-rate income');
}

/* ============================================================
   Report sections
   ============================================================ */

function buildItr2ReportSections(d: Itr2Detail): ReportSection[] {
  const money = (label: string, v: Valued, highlight = false) => ({ label, value: v.value, highlight });
  const sections: ReportSection[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      summary: 'As per ITR-2 JSON — PartA_GEN1 + Verification.',
      details: [
        { label: 'Name', value: d.personal.name.toUpperCase() },
        { label: 'Father’s Name', value: d.personal.fatherName || '—' },
        { label: 'PAN', value: d.personal.pan },
        { label: 'Date of Birth', value: d.personal.dob || '—' },
        { label: 'Assessment Year', value: d.assessmentYear },
        { label: 'Financial Year', value: d.financialYear },
        { label: 'Tax Regime', value: d.regime === 'old' ? 'Old Regime' : 'New Regime (115BAC)' },
        { label: 'Residential Status', value: RESIDENT_MAP[d.personal.residentStatus] ?? (d.personal.residentStatus || '—') },
        { label: 'Filing Section', value: d.personal.filingSection || '—' },
        { label: 'Address', value: d.personal.address || '—' }
      ]
    }
  ];

  if (d.salary.incomeFromSalary.value !== 0 || d.salary.grossSalary.value !== 0) {
    sections.push({
      id: 'salary',
      title: 'Income from Salary',
      summary: `${d.salary.employers.length} employer(s) as per ITR-2 Schedule S.`,
      details: [
        ...d.salary.employers.map((e) => ({ label: `Employer: ${e.name}${e.tan ? ` (TAN ${e.tan})` : ''}`, value: '' })),
        money('Gross salary', d.salary.grossSalary),
        money('Value of perquisites', d.salary.perquisites),
        money('Profits in lieu of salary', d.salary.profitsInSalary),
        money('Exempt allowances (u/s 10)', d.salary.exemptAllowances),
        money('Net salary (after exemptions)', d.salary.netSalary),
        money('Less: Standard Deduction u/s 16(ia)', d.salary.standardDeduction16ia),
        money('Less: Entertainment allowance u/s 16(ii)', d.salary.entertainment16ii),
        money('Less: Professional tax u/s 16(iii)', d.salary.professionalTax16iii),
        money('Income chargeable under Salary', d.salary.incomeFromSalary, true)
      ]
    });
  }

  if (d.houseProperties.length > 0) {
    sections.push({
      id: 'houseproperty',
      title: 'Income from House Property',
      summary: `${d.houseProperties.length} property(ies) as per ITR-2 Schedule HP.`,
      details: d.houseProperties.flatMap((p, i) => [
        { label: `Property ${i + 1}${p.address ? ` — ${p.address}` : ''}${p.letOut ? ` · ${p.letOut}` : ''}`, value: '' },
        money('  Annual Letable Value', p.annualLetableValue),
        money('  Less: Municipal taxes', p.municipalTaxes),
        money('  Less: Rent not realized', p.rentNotRealized),
        money('  Net Annual Value', p.balanceALV),
        money('  Less: 30% of NAV u/s 24(a)', p.std30),
        money('  Less: Interest on borrowed capital u/s 24(b)', p.interestOnBorrowedCapital),
        money('  Income / Loss from House Property', p.incomeOrLoss, true)
      ])
    });
  }

  if (d.capitalGains.total !== 0) {
    sections.push({
      id: 'capitalgains',
      title: 'Capital Gains',
      summary: 'As per ITR-2 Schedule CG For 23 / 112A / 115AD / VDA — short & long term.',
      details: [
        ...d.capitalGains.items.map((i) => money(i.label, { value: i.amount, source: 'JSON' as SourceTag })),
        money('Total Short-term capital gains', { value: d.capitalGains.totalStcg, source: 'CALCULATED' as SourceTag }),
        money('Total Long-term capital gains', { value: d.capitalGains.totalLtcg, source: 'CALCULATED' as SourceTag }),
        money('Total Capital Gains', { value: d.capitalGains.total, source: 'CALCULATED' as SourceTag }, true)
      ]
    });
  }

  if (d.otherSources.total.value !== 0) {
    sections.push({
      id: 'othersources',
      title: 'Income from Other Sources',
      summary: 'As per ITR-2 Schedule OS.',
      details: [
        ...d.otherSources.breakdown.map((o) => money(o.label, { value: o.amount, source: 'JSON' as SourceTag })),
        money('Gross income chargeable at applicable rate', d.otherSources.grossIncome),
        money('Less: Deductions u/s 57', d.otherSources.deductions),
        money('Total Income from Other Sources', d.otherSources.total, true)
      ]
    });
  }

  sections.push({
    id: 'computation',
    title: 'Computation of Total Income & Tax',
    summary: `${d.regime === 'old' ? 'Old regime' : 'New regime (115BAC)'} — as per ITR-2 Part B (PartB-TI + PartB_TTI).`,
    details: [
      money('Income from Salary', { value: d.income.salary, source: 'JSON' as SourceTag }),
      money('Income from House Property', { value: d.income.houseProperty, source: 'JSON' as SourceTag }),
      money('Capital Gains', { value: d.income.capitalGains, source: 'JSON' as SourceTag }),
      money('Other Sources', { value: d.income.otherSources, source: 'JSON' as SourceTag }),
      money('Gross Total Income', { value: d.income.grossTotal, source: 'JSON' as SourceTag }, true),
      money(`Less: Deductions u/s 80C–80U${d.regime === 'new' ? ' — Nil under New Regime' : ''}`, { value: d.regime === 'old' ? d.income.viaDeductions : 0, source: 'JSON' as SourceTag }),
      money('Total Income (as per ITR)', { value: d.income.totalIncome, source: 'JSON' as SourceTag }),
      money('Less: Special-rate income', { value: d.income.specialRateIncome, source: 'JSON' as SourceTag }),
      money('Aggregate Income (for normal rates)', { value: d.income.aggregateIncome, source: 'JSON' as SourceTag }, true),
      money('Tax on aggregate income (normal rates)', { value: d.taxComputed.taxNormal, source: 'JSON' as SourceTag }),
      ...(d.taxComputed.taxSpecialRates ? [money('Tax on special-rate incomes', { value: d.taxComputed.taxSpecialRates, source: 'JSON' as SourceTag })] : []),
      money('Surcharge', { value: d.taxComputed.surcharge, source: 'JSON' as SourceTag }),
      money('Health & Education Cess (4%)', { value: d.taxComputed.educationCess, source: 'JSON' as SourceTag }),
      money('Gross Tax Liability', { value: d.taxComputed.grossTaxLiability, source: 'JSON' as SourceTag }, true),
      money('Less: Relief u/s 89/90/91', { value: d.taxComputed.taxRelief, source: 'JSON' as SourceTag }),
      money('Net Tax Liability', { value: d.taxComputed.netTaxLiability, source: 'JSON' as SourceTag }),
      money('Add: Interest u/s 234A/B/C', { value: d.taxComputed.totalInterest, source: 'JSON' as SourceTag }),
      money('Aggregate Tax & Interest', { value: d.taxComputed.aggregateLiability, source: 'JSON' as SourceTag }, true)
    ]
  });

  sections.push({
    id: 'taxespaid',
    title: 'Taxes Paid & Refund / Payable',
    summary: 'As per ITR-2 Schedule IT + Part B — compared with HISAB computation.',
    details: [
      { label: 'Advance Tax', value: d.taxesPaid.advanceTax },
      { label: 'TDS (Form 26AS / AIS)', value: d.taxesPaid.tds },
      { label: 'TCS', value: d.taxesPaid.tcs },
      { label: 'Self-Assessment Tax', value: d.taxesPaid.selfAssessmentTax },
      { label: 'Total Taxes Paid', value: d.taxesPaid.total, highlight: true },
      { label: 'Balance Payable (as per ITR)', value: d.taxesPaid.balancePayable },
      { label: 'Refund Due (as per ITR)', value: d.refund.refundDue, highlight: true }
    ]
  });

  if (d.cfl.hpLoss || d.cfl.stcgLoss || d.cfl.ltcgLoss || d.cfl.raceHorseLoss) {
    sections.push({
      id: 'cfl',
      title: 'Losses Carried Forward',
      summary: 'As per ITR-2 Schedule CFL — total summary.',
      details: [
        ...(d.cfl.hpLoss ? [{ label: 'House property loss', value: d.cfl.hpLoss }] : []),
        ...(d.cfl.stcgLoss ? [{ label: 'Short-term capital loss', value: d.cfl.stcgLoss }] : []),
        ...(d.cfl.ltcgLoss ? [{ label: 'Long-term capital loss', value: d.cfl.ltcgLoss }] : []),
        ...(d.cfl.raceHorseLoss ? [{ label: 'Race-horse loss', value: d.cfl.raceHorseLoss }] : [])
      ]
    });
  }

  if (d.verification.name) {
    sections.push({
      id: 'verification',
      title: 'Verification & Declaration',
      summary: 'As per ITR-2 Verification block.',
      details: [
        { label: 'Verified by', value: d.verification.name.toUpperCase() },
        { label: 'Father’s / Spouse’s Name', value: d.verification.fatherName || '—' },
        { label: 'PAN', value: d.verification.pan },
        { label: 'Capacity', value: d.verification.capacity || 'Assessee' },
        { label: 'Place', value: d.verification.place || '—' },
        { label: 'Date', value: d.verification.date || '—' }
      ]
    });
  }

  return sections;
}