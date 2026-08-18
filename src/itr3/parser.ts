import type {
  Itr3CapGainItem,
  Itr3CfLoss,
  Itr3ChapterVia,
  Itr3Detail,
  Itr3HouseProperty,
  Itr3LossHead,
  Itr3Salary,
  Itr3SpecialIncome,
  Itr3Verification,
  IncomeSource,
  NormalizedITR,
  ReportSection,
  SourceTag,
  Taxpayer,
  Valued,
  ValidationIssue
} from '../types';
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

export interface Itr3ParseResult {
  normalized: NormalizedITR;
  issues: ValidationIssue[];
}

/* ============================================================
   ITR-3 parser — Individuals / HUFs with business or profession
   Handles the real e-filing JSON schema (e.g. anant + aniket
   fixtures). Field names drift between utilities (e.g.
   CreditUs115JD vs CreditUS115JD) — all lookups are defensive.
   ============================================================ */

export function parseItr3(raw: string): Itr3ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(raw).trim());
  } catch {
    throw new Error(
      'This file could not be read as JSON. Please upload the ITR export from the e-filing portal (expected structure: { "ITR": { "ITR3": { ... } } }).'
    );
  }
  return parseItr3Object(data);
}

export function parseItr3Object(input: unknown): Itr3ParseResult {
  const issues: ValidationIssue[] = [];
  const root = obj(input);
  const itr = obj(root.ITR);
  const itr3 = obj(itr.ITR3);
  if (!itr.ITR3) {
    throw new Error('This file is not an ITR-3 export.');
  }

  /* ---------- Personal / filing ---------- */
  const gen1 = obj(itr3.PartA_GEN1);
  const personalInfo = obj(gen1.PersonalInfo);
  const assesseeName = obj(personalInfo.AssesseeName);
  const address = obj(personalInfo.Address);
  const filingStatus = obj(gen1.FilingStatus);
  const gen2 = obj(itr3.PartA_GEN2);
  const verification = obj(itr3.Verification);
  const declaration = obj(verification.Declaration);
  const formItr3 = obj(itr3.Form_ITR3);
  const creationInfo = obj(itr3.CreationInfo);

  const firstName = String(assesseeName.FirstName ?? '');
  const middleName = String(assesseeName.MiddleName ?? '');
  const surName = String(assesseeName.SurNameOrOrgName ?? assesseeName.Name ?? '');
  const name = `${firstName} ${middleName} ${surName}`.replace(/\s+/g, ' ').trim() || 'Unknown Taxpayer';
  const pan = String(personalInfo.PAN ?? declaration.AssesseeVerPAN ?? 'ABCDE1234F').toUpperCase();

  /* ---------- Assessment / financial years ----------
     The utility encodes AssessmentYear as the FIRST year of the AY
     (e.g. "2026" -> AY 2026-27, FY 2025-26). Schedule AMTC's
     CurrAssYr (e.g. "2026-27") is authoritative when present. */
  const amtcCurrAssYr = String(obj(itr3.ScheduleAMTC).CurrAssYr ?? '').trim();
  const ayRaw = pick(formItr3, ['AssessmentYear']) ?? personalInfo.AssessmentYear;
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

  if (!assessmentYear.includes('-')) {
    const n = num(assessmentYear);
    if (n >= 2015 && n <= 2040) assessmentYear = `${n}-${String(n + 1).slice(2)}`;
  }

  const optedNew = String(filingStatus.OptNewRegimeCurrAY ?? filingStatus.OptOldRegimeCurrAY ?? '').toUpperCase();
  const regime: 'new' | 'old' = optedNew === 'Y' ? 'old' : filingStatus.OptOldRegimeCurrAY ? 'old' : 'new';

  const stateCodeKey = String(address.StateCode ?? '').trim().padStart(2, '0');
  const stateName = STATE_MAP[stateCodeKey] ?? STATE_MAP[stateCodeKey.slice(1)] ?? '';
  const addressParts = [
    String(address.ResidenceNo ?? ''),
    String(address.RoadOrStreet ?? ''),
    String(address.LocalityOrArea ?? ''),
    String(address.CityOrTownOrDistrict ?? ''),
    stateName,
    String(address.PinCode ?? address.PINCode ?? '')
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
  const mobileRaw = String(address.MobileNo ?? '');
  const ackNumber = String(personalInfo.AckNumber ?? creationInfo.AckNumber ?? formItr3.AckNumber ?? '') || '—';
  const filingDate = String(creationInfo.JSONCreationDate ?? personalInfo.FilingDate ?? '') || '—';
  const retFileSec = num(filingStatus.ReturnFileSec);
  const filingSection = retFileSec === 11 ? '139(1) – On Time' : retFileSec > 0 ? `139(${retFileSec === 4 ? '4' : '1'})` : '';

  const dobsrc = pick(personalInfo, ['DOB', 'DateOfBirth']);
  const dob = dobsrc ? String(dobsrc) : '';

  /* ---------- Nature of business ---------- */
  const nob = obj(gen2.NatOfBus);
  const nobList = Array.isArray(nob.NatureOfBusiness) ? (nob.NatureOfBusiness as Array<Record<string, unknown>>) : [];
  const naturesOfBusiness = nobList.map((n) => ({
    code: String(n.Code ?? ''),
    tradeName: String(n.TradeName1 ?? n.TradeName ?? ''),
    description: String(n.Description ?? '')
  }));

  /* ---------- Salary (Schedule S) ---------- */
  const schedS = obj(itr3.ScheduleS);
  const salariesRaw = Array.isArray(schedS.Salaries) ? (schedS.Salaries as Array<Record<string, unknown>>) : [];
  const employers = salariesRaw.map((s) => {
    const emp = obj(s.EmployerOrDeductorOrCollectDetl);
    const empDetl = Object.keys(emp).length ? emp : { TANofEmployer: s.TANofEmployer, NameOfEmployer: s.NameOfEmployer };
    const addr = obj(s.AddressDetail);
    return {
      name: String(empDetl.NameOfEmployer ?? s.NameOfEmployer ?? ''),
      tan: String(empDetl.TAN ?? s.TANofEmployer ?? ''),
      natureOfEmployment: String(s.NatureOfEmployment ?? ''),
      address: [
        String(addr.AddrDetail ?? ''),
        String(addr.CityOrTownOrDistrict ?? ''),
        String(addr.PinCode ?? '')
      ].filter(Boolean).join(', ')
    };
  });
  const grossSalary = vJSON(schedS.TotalGrossSalary);
  const exemptAllowances = vJSON(pick(schedS, ['AllwncExtentExemptUs10', 'TotalAllwncExemptUs10']));
  const hraRaw = obj(schedS.Section10_13A);
  const hraPresent = Object.keys(hraRaw).some((k) => num(hraRaw[k]) !== 0);
  const netSalary = vJSON(schedS.NetSalary);
  const stdDed16ia = vJSON(pick(schedS, ['DeductionUnderSection16ia', 'DeductionUS16', 'DeductionUs16']));
  const profTax = vJSON(pick(schedS, ['ProfessionalTaxUs16iii', 'ProfessionalTaxUs16iiiAmt']));
  const reportedSal = num(schedS.TotIncUnderHeadSalaries);
  const salaryIncomeCalc = Math.max(0, grossSalary.value - exemptAllowances.value - stdDed16ia.value - profTax.value);
  const incomeFromSalary: Valued = {
    value: reportedSal !== 0 ? reportedSal : salaryIncomeCalc,
    source: reportedSal !== 0 && Math.abs(reportedSal - salaryIncomeCalc) <= 1 ? 'VERIFIED' : reportedSal !== 0 ? 'JSON' : 'CALCULATED'
  };
  const salary: Itr3Salary = {
    employers,
    grossSalary,
    exemptAllowances,
    hra: {
      present: hraPresent,
      hraReceived: vJSON(hraRaw.ActlHRARecv),
      rentPaid: vJSON(hraRaw.ActlRentPaid),
      eligibleExemption: vJSON(hraRaw.EligbleExmpAllwncUs13A)
    },
    netSalary,
    standardDeduction16ia: stdDed16ia,
    professionalTax16iii: profTax,
    incomeFromSalary
  };

  /* ---------- House property (Schedule HP) ---------- */
  const schedHP = obj(itr3.ScheduleHP);
  const hpProps = Array.isArray(schedHP.PropertyDetails) ? (schedHP.PropertyDetails as Array<Record<string, unknown>>) : [];
  const houseProperties: Itr3HouseProperty[] = hpProps.map((p) => {
    const addr = obj(p.AddressDetailWithZipCode);
    const rent = obj(p.Rentdetails);
    const tenants = Array.isArray(p.TenantDetails) ? (p.TenantDetails as Array<Record<string, unknown>>) : [];
    return {
      propertyNo: num(p.HPSNo),
      address: [
        String(addr.AddrDetail ?? ''),
        String(addr.CityOrTownOrDistrict ?? ''),
        String(addr.PinCode ?? '')
      ].filter(Boolean).join(', '),
      owner: String(p.PropertyOwner ?? ''),
      coOwned: String(p.PropCoOwnedFlg ?? '').toUpperCase() === 'YES',
      share: num(p.AsseseeShareProperty),
      letOut: String(p.ifLetOut ?? ''),
      tenant: tenants.map((t) => String(t.NameofTenant ?? '')).join(', '),
      annualLetableValue: vJSON(rent.AnnualLetableValue),
      rentNotRealized: vJSON(rent.RentNotRealized),
      municipalTaxes: vJSON(rent.LocalTaxes),
      balanceALV: vJSON(rent.BalanceALV),
      std30: vJSON(rent.ThirtyPercentOfBalance),
      interestOnBorrowedCapital: vJSON(rent.IntOnBorwCap),
      arrearsUnrealizedRent: vJSON(rent.ArrearsUnrealizedRentRcvd),
      incomeOrLoss: vJSON(rent.IncomeOfHP)
    };
  });
  const incomeFromHP = num(schedHP.TotalIncomeChargeableUnHP) || houseProperties.reduce((s, p) => s + p.incomeOrLoss.value, 0);

  /* ---------- Business (ITR3 Schedule BP) ---------- */
  const schedBP = obj(itr3.ITR3ScheduleBP);
  const busRaw = obj(schedBP.BusinessIncOthThanSpec);
  const profitBeforeTax = num(busRaw.ProfBfrTaxPL);
  const balancePL = num(pick(busRaw, ['BalancePLOthThanSpecBus', 'BalancePLSpecBus']));
  const adjustedPL = num(pick(busRaw, ['AdjustedPLOthThanSpecBus', 'AdjustedPLSpecBus']));
  const depreciation = num(busRaw.DepreciationAllowITAct32);
  const netPL = num(pick(busRaw, ['NetPLAftAdjBusOthThanSpec', 'NetPLBusOthThanSpec7A7B7C']));
  const businessIncome = num(schedBP.IncChrgUnHdProftGain) || num(pick(busRaw, ['NetPLAftAdjBusOthThanSpec', 'IncomeOtherThanRule']));

  const plRaw = obj(itr3.PARTA_PL);
  const methodOfAccounting = String(obj(itr3.PARTA_OI).MethodOfAcct ?? '');
  const auditInfo = obj(gen2.AuditInfo);
  const pnl = buildPnL(plRaw, profitBeforeTax, num(plRaw.PBT));

  const balanceSheet = buildBalanceSheet(itr3.PARTA_BS);

  /* ---------- Depreciation (DPM / DOA / DEP) ---------- */
  const depBlocks: Itr3Detail['depreciation']['blocks'] = [];
  let totalDepreciation = 0;
  const collectDep = (node: unknown, rate: number, block: string) => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (rec.DepreciationDetail && Array.isArray(rec.DepreciationDetail)) {
      for (const d of rec.DepreciationDetail as Array<Record<string, unknown>>) {
        const dep = num(d.Depreciation);
        totalDepreciation += dep;
        depBlocks.push({
          block,
          rate,
          openingWdv: num(d.OpeningWrittenDownValue),
          additions: num(d.AdditionsDuringTheYear),
          sales: num(d.SalesDuringTheYear),
          depreciation: dep,
          closingWdv: num(d.ClosingWrittenDownValue)
        });
      }
      return;
    }
    for (const k of Object.keys(rec)) {
      collectDep(rec[k], rate, block);
    }
  };
  const rateOf = (key: string): number => parseInt(key.replace(/[^\d]/g, ''), 10) || 0;
  const mapAsset = (node: unknown, block: string) => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
      const rate = rateOf(k);
      if (rec[k] && typeof rec[k] === 'object') {
        collectDep(rec[k], rate || 15, block);
      }
    }
  };
  mapAsset(itr3.ScheduleDPM, 'Plant & Machinery');
  mapAsset(itr3.ScheduleDOA, 'Other Assets');

  /* ---------- Capital gains ---------- */
  const cg = buildCapitalGains(itr3);

  /* ---------- Other sources (Schedule OS) ---------- */
  const schedOS = obj(itr3.ScheduleOS);
  const osRaw = obj(schedOS.IncOthThanOwnRaceHorse);
  const savingsInt = num(osRaw.IntrstFrmSavingBank);
  const termDep = num(osRaw.IntrstFrmTermDeposit);
  const otherInt = num(osRaw.IntrstFrmOthers);
  const osTotalReported = num(schedOS.TotOthSrcNoRaceHorse) || num(schedOS.IncChargeable) || num(osRaw.BalanceNoRaceHorse);
  const osBreakdown: Array<{ label: string; amount: number }> = [];
  if (savingsInt) osBreakdown.push({ label: 'Savings bank interest', amount: savingsInt });
  if (termDep) osBreakdown.push({ label: 'Interest on term deposits', amount: termDep });
  if (otherInt) osBreakdown.push({ label: 'Interest from other sources', amount: otherInt });
  const otherSources = {
    savingsInterest: vJSON(savingsInt),
    termDepositInterest: vJSON(termDep),
    otherInterest: vJSON(otherInt),
    others: osBreakdown,
    total: { value: osTotalReported, source: (osTotalReported !== 0 ? 'JSON' : 'CALCULATED') as SourceTag }
  };

  /* ---------- CYLA / BFLA / CFL ---------- */
  const cyla = buildLossHeads(itr3.ScheduleCYLA, (r) => pick(r, ['IncOfCurYrUnderThatHead', 'IncOfCurYrUndHeadFromCYLA']), 'AfterSetOff');
  const bfla = buildLossHeads(itr3.ScheduleBFLA, (r) => pick(r, ['IncOfCurYrUndHeadFromCYLA', 'IncOfCurYrUnderThatHead']), 'AfterSetOff');
  const cfl = buildCfLoss(itr3.ScheduleCFL);

  /* ---------- Chapter VI-A ---------- */
  const via = buildVia(itr3.ScheduleVIA, itr3.Schedule80C);

  /* ---------- AMT / AMTC ---------- */
  const schedAMT = obj(itr3.ScheduleAMT);
  const schedAMTC = obj(itr3.ScheduleAMTC);
  const amtCarried = Array.isArray(schedAMTC.ScheduleAMTCDtls)
    ? (schedAMTC.ScheduleAMTCDtls as Array<Record<string, unknown>>)
    : [];
  const amt = {
    adjustedTotalIncome: num(pick(schedAMT, ['AdjustedUnderSec115JC', 'AdjustedUnderSec115JCOther', 'TotalIncItem11'])),
    amtTax: num(schedAMTC.TaxOthProvisions),
    amtCreditAvailable: num(schedAMTC.AmtTaxCreditAvailable),
    amtCreditCarriedForward: amtCarried.map((a) => ({ year: String(a.AssYr ?? ''), credit: num(a.BalAmtCreditCarryFwd) }))
  };

  /* ---------- Special income (Schedule SI) ---------- */
  const schedSI = obj(itr3.ScheduleSI);
  const siRows = Array.isArray(schedSI.SplCodeRateTax) ? (schedSI.SplCodeRateTax as Array<Record<string, unknown>>) : [];
  const specialIncomes: Itr3SpecialIncome[] = siRows
    .map((s) => ({
      code: String(s.SecCode ?? ''),
      rate: num(s.SplRatePercent),
      amount: num(s.SplRateInc),
      tax: num(s.SplRateIncTax)
    }))
    .filter((s) => s.amount !== 0);

  /* ---------- Part B — income aggregation ---------- */
  const partBTI = obj(itr3['PartB-TI']);
  const pbg = obj(partBTI.ProfBusGain);
  const capGainRaw = obj(partBTI.CapGain);
  const osHead = obj(partBTI.IncFromOS);
  const viaDtl = obj(partBTI.DeductionsUndSchVIADtl);
  const salaryIncomeHead = num(partBTI.Salaries) !== 0 ? num(partBTI.Salaries) : incomeFromSalary.value;
  const businessHead = num(pbg.TotProfBusGain) !== 0 ? num(pbg.TotProfBusGain) : businessIncome;
  const capGainHead = num(pick(capGainRaw, ['TotalCapGains', 'ShortTermLongTermTotal']));
  const osHeadInc = num(pick(osHead, ['TotIncFromOS', 'IncChargblSplRate']));
  const grossTotal = num(partBTI.GrossTotalIncome) || (salaryIncomeHead + incomeFromHP + businessHead + capGainHead + osHeadInc);
  const totalIncome = num(pick(partBTI, ['TotalIncome', 'AggregateIncome'])) || num(partBTI.TotalIncome);
  const aggregateIncome = num(pick(partBTI, ['AggregateIncome', 'TotalIncome']));
  const viaDeductionTotal = num(pick(viaDtl, ['TotDeductUndSchVIA', 'TotPartBchapterVIA']));

  const income = {
    salary: salaryIncomeHead,
    houseProperty: incomeFromHP,
    business: businessHead,
    capitalGains: capGainHead,
    otherSources: osHeadInc || otherSources.total.value,
    grossTotal,
    totalIncome,
    aggregateIncome
  };

  /* ---------- Part B — tax computation ---------- */
  const partBTTI = obj(itr3.PartB_TTI);
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
    surcharge: num(pick(taxOnTI, ['TotalSurcharge', 'SurchargeOnAboveCrore'])),
    educationCess: num(pick(taxOnTI, ['EducationCess', 'GrossTaxLiability'])) !== num(taxOnTI.GrossTaxLiability) ? num(taxOnTI.EducationCess) : num(taxOnTI.EducationCess),
    grossTaxLiability: num(taxOnTI.GrossTaxLiability) || num(pick(taxCompRaw, ['GrossTaxPayable', 'TaxPayAfterCreditUs115JD'])),
    taxRelief: num(taxRelief.TotTaxRelief) || num(taxOnTI.RebateOnAgriInc),
    netTaxLiability: num(taxCompRaw.NetTaxLiability),
    interest234A: num(intrstRaw.IntrstPayUs234A),
    interest234B: num(intrstRaw.IntrstPayUs234B),
    interest234C: num(intrstRaw.IntrstPayUs234C),
    lateFee234F: num(intrstRaw.LateFilingFee234F),
    totalInterest: num(intrstRaw.TotalIntrstPay) || (num(intrstRaw.IntrstPayUs234B) + num(intrstRaw.IntrstPayUs234C)),
    aggregateLiability: num(pick(taxCompRaw, ['AggregateTaxInterestLiability', 'NetTaxLiability', 'GrossTaxPayable']))
  };
  taxComputed.grossTaxLiability = taxComputed.grossTaxLiability || taxOnTI.GrossTaxLiability ? num(taxOnTI.GrossTaxLiability) : taxComputed.grossTaxLiability;

  /* ---------- Taxes paid ---------- */
  const schedIT = obj(itr3.ScheduleIT);
  const challanRows = Array.isArray(schedIT.TaxPayment) ? (schedIT.TaxPayment as Array<Record<string, unknown>>) : [];
  const challans = challanRows.map((c) => ({
    bsrCode: String(c.BSRCode ?? ''),
    date: String(c.DateDep ?? ''),
    cino: String(c.SrlNoOfChaln ?? ''),
    amount: num(c.Amt)
  }));

  const schedTDS1 = obj(itr3.ScheduleTDS1);
  const tds1Rows = Array.isArray(schedTDS1.TDSonSalary) ? (schedTDS1.TDSonSalary as Array<Record<string, unknown>>) : [];
  const tdsSalary = tds1Rows.map((t) => {
    const emp = obj(t.EmployerOrDeductorOrCollectDetl);
    return { name: String(emp.EmployerOrDeductorOrCollecterName ?? ''), tan: String(emp.TAN ?? ''), income: num(t.IncChrgSal), tds: num(t.TotalTDSSal) };
  });

  const schedTDS2 = obj(itr3.ScheduleTDS2);
  const tds2Rows = Array.isArray(schedTDS2.TDSOthThanSalaryDtls) ? (schedTDS2.TDSOthThanSalaryDtls as Array<Record<string, unknown>>) : [];
  const tdsOther = tds2Rows.map((t) => {
    const cred = obj(t.TaxDeductCreditDtls);
    return {
      deductor: String(t.TANOfDeductor ?? ''),
      tan: String(t.TANOfDeductor ?? ''),
      section: String(t.TDSSection ?? ''),
      grossAmount: num(t.GrossAmount),
      tds: num(cred.TaxClaimedOwnHands),
      head: String(t.HeadOfIncome ?? '')
    };
  });

  const advanceTax = num(taxesPaidObj.AdvanceTax);
  const tds = num(taxesPaidObj.TDS) || num(schedTDS1.TotalTDSonSalaries);
  const tcs = num(taxesPaidObj.TCS);
  const selfAssessment = num(taxesPaidObj.SelfAssessmentTax);
  const totalPaid = num(taxesPaidObj.TotalTaxesPaid) || (advanceTax + tds + tcs + selfAssessment);
  const balancePayable = num(taxPaidRaw.BalTaxPayable);
  const refundDue = num(refundRaw.RefundDue) || Math.max(0, totalPaid - (taxComputed.aggregateLiability || taxComputed.grossTaxLiability));

  const bankRows = Array.isArray(obj(refundRaw.BankAccountDtls).AddtnlBankDetails)
    ? (obj(refundRaw.BankAccountDtls).AddtnlBankDetails as Array<Record<string, unknown>>)
    : [];
  const banks = bankRows.map((b) => ({
    name: String(b.BankName ?? ''),
    accountNo: String(b.BankAccountNo ?? ''),
    ifsc: String(b.IFSCCode ?? ''),
    accountType: String(b.AccountType ?? ''),
    useForRefund: String(b.UseForRefund ?? '').toLowerCase() === 'true'
  }));
  const refund = { refundDue, banks };

  /* ---------- Verification ---------- */
  const verificationDetail: Itr3Verification = {
    name: String(declaration.AssesseeVerName ?? name),
    fatherName: String(declaration.FatherName ?? '').replace(/\s+/g, ' ').trim(),
    pan: String(declaration.AssesseeVerPAN ?? pan),
    capacity: String(verification.Capacity ?? ''),
    date: String(verification.Date ?? '') || filingDate,
    place: String(verification.Place ?? '')
  };

  /* ---------- Assemble detail ---------- */
  const detail: Itr3Detail = {
    form: 'ITR3',
    assessmentYear,
    financialYear,
    regime,
    personal: {
      name,
      pan,
      fatherName: verificationDetail.fatherName,
      dob,
      aadhaar: String(personalInfo.AadhaarCardNo ?? ''),
      mobile: mobileRaw ? (mobileRaw.startsWith('+') ? mobileRaw : `+91-${mobileRaw}`) : '',
      email: String(address.EmailAddress ?? ''),
      address: fullAddress,
      city: String(address.CityOrTownOrDistrict ?? '').split(',')[0].trim(),
      state: stateName,
      pinCode: String(address.PinCode ?? ''),
      status: String(personalInfo.Status ?? ''),
      residentStatus: String(filingStatus.ResidentialStatus ?? ''),
      filingSection,
      returnFileSec: retFileSec,
      ackNumber,
      filingDate
    },
    salary,
    houseProperties,
    business: {
      naturesOfBusiness,
      methodOfAccounting,
      booksOfAccount: String(pick(auditInfo, ['LiableSec44AAflg', 'BooksOfAccount']) ?? ''),
      audited: String(auditInfo.LiableSec44ABflg ?? ''),
      turnoverBand: String(auditInfo.TotalSalesExcOneCr ?? ''),
      profitBeforeTax: vJSON(profitBeforeTax),
      balancePL: vJSON(balancePL),
      netPL: vJSON(netPL),
      depreciation: vJSON(depreciation),
      adjustedPL: vJSON(adjustedPL),
      incomeChargeable: vJSON(businessIncome)
    },
    depreciation: { blocks: depBlocks, totalDepreciation },
    balanceSheet,
    pnl,
    capitalGains: cg,
    otherSources,
    cyla,
    bfla,
    cfl,
    via,
    amt,
    specialIncomes,
    income,
    taxComputed,
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
  if (profitBeforeTax > 0 && balancePL === 0 && businessIncome === 0) {
    issues.push({ path: 'ITR3ScheduleBP', message: 'Business profit reported in P&L but no chargeable business income found in Schedule BP.', severity: 'warning' });
  }
  if (incomeFromSalary.source === 'CALCULATED' && grossSalary.value > 0) {
    issues.push({ path: 'ScheduleS.TotIncUnderHeadSalaries', message: 'Income from salary reconstructed from components (computed value differs from reported).', severity: 'warning' });
  }
  if (grossTotal > 0 && Math.abs(grossTotal - (salaryIncomeHead + incomeFromHP + businessHead + capGainHead + osHeadInc)) > 1) {
    issues.push({ path: 'PartB-TI.GrossTotalIncome', message: 'Gross total income does not equal the sum of income heads — shown in HISAB Check.', severity: 'warning' });
  }

  /* ---------- Taxpayer ---------- */
  const taxpayer: Taxpayer = {
    name,
    pan,
    assessmentYear,
    financialYear,
    type: naturesOfBusiness.length ? 'business' : 'other',
    regime,
    city: detail.personal.city,
    state: stateName,
    pinCode: detail.personal.pinCode,
    fatherName: detail.personal.fatherName,
    dob,
    aadhaar: detail.personal.aadhaar,
    mobile: detail.personal.mobile,
    email: detail.personal.email,
    residentStatus: detail.personal.residentStatus,
    filingSection,
    address: fullAddress,
    businessName: naturesOfBusiness[0]?.tradeName || '',
    businessCode: naturesOfBusiness[0]?.code || '',
    natureOfBusiness: naturesOfBusiness.map((n) => n.description || n.tradeName).filter(Boolean).join(', '),
    bankName: banks.find((b) => b.useForRefund)?.name || banks[0]?.name || '',
    accountNo: banks.find((b) => b.useForRefund)?.accountNo || banks[0]?.accountNo || '',
    ifsc: banks.find((b) => b.useForRefund)?.ifsc || banks[0]?.ifsc || '',
    accountType: banks.find((b) => b.useForRefund)?.accountType || banks[0]?.accountType || '',
    refundDue
  };

  const sourceRows: IncomeSource[] = [
    { code: 'SAL', label: 'Income from Salary', amount: salaryIncomeHead },
    { code: 'HP', label: 'Income from House Property', amount: incomeFromHP },
    { code: 'BP', label: 'Business / Profession', amount: businessHead },
    { code: 'CG', label: 'Capital Gains', amount: capGainHead },
    { code: 'OS', label: 'Other Sources', amount: osHeadInc }
  ].filter((s) => s.amount !== 0);
  sourceRows.forEach((s) => { s.percentage = grossTotal > 0 ? (s.amount / grossTotal) * 100 : 0; });

  const taxComputation = {
    regime,
    grossTotalIncome: grossTotal,
    deductions: via.breakdown.map((d) => ({ code: d.code, label: d.code, amount: d.amount, section: d.code })),
    totalDeductions: viaDeductionTotal,
    taxableIncome: totalIncome,
    taxBeforeCess: Math.max(0, taxComputed.taxNormal + taxComputed.taxSpecialRates - taxComputed.taxRelief),
    surcharge: taxComputed.surcharge,
    healthCess: taxComputed.educationCess,
    rebate: 0,
    totalTax: taxComputed.grossTaxLiability,
    advanceTax,
    tds,
    selfAssessmentTax: selfAssessment,
    netTaxPayable: Math.max(0, totalPaid - (taxComputed.aggregateLiability || taxComputed.grossTaxLiability)),
    effectiveRate: grossTotal > 0 ? (taxComputed.grossTaxLiability / grossTotal) * 100 : 0
  };

  const normalized: NormalizedITR = {
    taxpayer,
    itrForm: 'ITR3',
    itr3: detail,
    incomeBreakdown: {
      businessIncome: businessHead,
      capitalGains: capGainHead,
      otherSources: osHeadInc,
      total: grossTotal,
      grossReceipts: 0,
      sources: sourceRows as Array<{ code: string; label: string; amount: number; percentage: number }>
    },
    expenseSummary: {
      total: pnl.present ? pnl.expenses.reduce((s, e) => s + e.amount, 0) : 0,
      items: pnl.present ? pnl.expenses.map((e, i) => ({ id: `exp-${i}`, category: 'Business', label: e.label, amount: e.amount })) : []
    },
    depreciation: { totalDepreciation, assets: depBlocks.map((b, i) => ({
      id: `dep-${i}`, blockName: b.block, rate: b.rate, openingWdv: b.openingWdv, additions: b.additions, sales: b.sales, closingWdv: b.closingWdv, depreciation: b.depreciation
    })) },
    taxComputation,
    reportSections: buildItr3ReportSections(detail),
    computedAt: new Date().toISOString()
  };

  return { normalized, issues };
}

/* ============================================================
   Helpers
   ============================================================ */

function buildPnL(plRaw: Record<string, unknown>, pbdt: number, pbt: number): Itr3Detail['pnl'] {
  const credits = obj(plRaw.CreditsToPL);
  const othIncome = obj(credits.OthIncome);
  const salesOrReceipts = num(pick(credits, ['TotSales', 'GrossReceipts', 'TotCreditsToPL'])) - num(othIncome.TotOthIncome);
  const otherIncome = num(othIncome.TotOthIncome);

  const debits = obj(plRaw.DebitsToPL);
  const expenseMap: Array<[string, unknown]> = [
    ['Purchases', pick(debits, ['Purchases', 'TotPurchases'])],
    ['Employee compensation', num(obj(debits.EmployeeComp).TotEmpComp) || pick(debits, ['EmployeeCompTotal', 'TotEmpComp'])],
    ['Rent', pick(debits, ['Rent', 'RentPaid'])],
    ['Insurance', num(obj(debits.Insurances).TotInsurance) || pick(debits, ['Insurance'])],
    ['Interest expense', num(obj(debits.InterestExpdrtDtls).TotInterest) || pick(debits, ['InterestExpdrtDtls'])],
    ['Travel expenses', pick(debits, ['TravelExp'])],
    ['Other expenses', pick(debits, ['OthExpenses', 'TotOthExpenses'])]
  ];
  const expenses = expenseMap
    .map(([label, val]) => ({ label, amount: num(val) }))
    .filter((e) => e.amount > 0);

  const pnlPresent = pbdt !== 0 || pbt !== 0 || salesOrReceipts !== 0 || Object.keys(plRaw).length > 0 && num(plRaw.PBT) !== 0;
  return {
    present: pnlPresent,
    salesOrReceipts: Math.max(0, salesOrReceipts),
    otherIncome,
    expenses,
    pbdt: num(pbdt) || num(plRaw.PBIDTA),
    pbt: num(pbt) || num(plRaw.PBT),
    netProfit: num(plRaw.ProfitAfterTax) || num(plRaw.PBT)
  };
}

function buildBalanceSheet(bsRaw: unknown): Itr3Detail['balanceSheet'] {
  const bs = obj(bsRaw);
  const fundSrc = obj(bs.FundSrc);
  const propFund = obj(fundSrc.PropFund);
  const loanFunds = obj(fundSrc.LoanFunds);
  const secrLoan = obj(loanFunds.SecrLoan);
  const rupeeLoan = obj(secrLoan.RupeeLoan);
  const unsecrLoan = obj(loanFunds.UnsecrLoan);

  const fundApply = obj(bs.FundApply);
  const fixedAsset = obj(fundApply.FixedAsset);
  const investments = obj(fundApply.Investments);
  const currSection = obj(fundApply.CurrAssetLoanAdv);
  const currAsset = obj(currSection.CurrAsset);
  const inventory = obj(currAsset.Inventories);
  const cashBank = obj(currAsset.CashOrBankBal);
  const loanAdv = obj(currSection.LoanAdv);

  const capital = num(propFund.PropCap) || num(propFund.TotPropFund);
  const securedLoans = num(rupeeLoan.TotRupeeLoan) || num(secrLoan.TotSecrLoan);
  const unsecuredLoans = num(unsecrLoan.TotUnsecrLoan);
  const fixedAssets = num(fixedAsset.NetBlock) || num(fixedAsset.TotFixedAsset);
  const invest = num(investments.TotInvestments);
  const inventories = num(inventory.TotInventories) || num(inventory.TotInventory);
  const debtors = num(currAsset.SndryDebtors);
  const bank = num(cashBank.BankBal);
  const cash = num(cashBank.CashinHand);
  const otherAssets = num(currAsset.OthCurrAsset) || num(currAsset.OtherCurrAsset) || num(loanAdv.TotLoanAdv);

  const totalLiab = num(fundSrc.TotFundSrc) || (capital + securedLoans + unsecuredLoans);
  const totalAssets = num(fundApply.TotFundApply) || (fixedAssets + invest + inventories + debtors + bank + cash + otherAssets);
  const present = totalLiab !== 0 || totalAssets !== 0;

  return {
    present,
    liabilities: { capital, securedLoans, unsecuredLoans, otherLiabilities: 0, total: totalLiab },
    assets: { fixedAssets, investments: invest, inventories, debtors, bank, cash, otherAssets, total: totalAssets },
    difference: Math.abs(totalLiab - totalAssets)
  };
}

function buildCapitalGains(itr3: Record<string, unknown>): Itr3Detail['capitalGains'] {
  const cg23 = obj(itr3.ScheduleCGFor23);
  const stcg23 = obj(cg23.ShortTermCapGainFor23);
  const sched112A = obj(itr3.Schedule112A);

  const item = (label: string, src: Record<string, unknown>): Itr3CapGainItem | null => {
    const amount = num(pick(src, ['CapgainonAssets', 'BalanceCG']));
    const consideration = num(pick(src, ['FullConsideration', 'FullValueConsdOthUnqshr', 'TotSaleValue']));
    const cost = num(pick(src, ['AquisitCost', 'CostAcqWithoutIndx', 'AcquisitionCost']));
    const exp = num(pick(src, ['ExpOnTrans', 'ExpExclCnctTransfer', 'TotalDedn']));
    if (amount === 0 && consideration === 0) return null;
    return { label, fullConsideration: consideration, cost, expenses: exp, amount };
  };

  const stcgFromAssets = obj(stcg23.SaleOnOtherAssets);
  const stcgEquity = Array.isArray(stcg23.EquityMFonSTT) ? (stcg23.EquityMFonSTT as Array<Record<string, unknown>>) : [];
  const stcgEquityItem = stcgEquity.map((e) => item('STCG on equity — u/s 111A', obj(e.EquityMFonSTTDtls))).filter((x): x is Itr3CapGainItem => x !== null);

  const ltcg112Arows = Array.isArray(sched112A.Schedule112ADtls) ? (sched112A.Schedule112ADtls as Array<Record<string, unknown>>) : [];
  const ltcg112A = item('LTCG u/s 112A', sched112A);
  const ltcg112ASum = num(sched112A.Balance112A) || ltcg112Arows.reduce((s, r) => s + num(r.Balance), 0);

  const stcgItems = [...stcgEquityItem];
  const stcgOther = item('STCG on other assets', stcgFromAssets);
  if (stcgOther && stcgOther.amount !== 0) stcgItems.push(stcgOther);
  const ltcgItems = ltcg112A ? [{ ...ltcg112A, amount: ltcg112ASum || ltcg112A.amount }] : [];
  if (ltcg112ASum && !ltcg112A) ltcgItems.push({ label: 'LTCG u/s 112A', fullConsideration: num(sched112A.SaleValue112A), cost: num(sched112A.AcquisitionCost112A), expenses: num(sched112A.ExpExclCnctTransfer112A), amount: ltcg112ASum });

  const stcgTotal = stcgItems.reduce((s, i) => s + i.amount, 0);
  const ltcgTotal = ltcgItems.reduce((s, i) => s + i.amount, 0);

  return {
    stcg112A: stcgEquityItem.find((i) => i.label.includes('111A')) ?? null,
    stcg2167: null,
    stcgOther: stcgOther && stcgOther.amount !== 0 ? stcgOther : null,
    ltcg112A: ltcgItems.find((i) => i.label.includes('112A')) ?? null,
    ltcg125: null,
    totalStcg: stcgTotal,
    totalLtcg: ltcgTotal,
    total: stcgTotal + ltcgTotal
  };
}

function buildLossHeads(
  sched: unknown,
  pickIncome: (r: Record<string, unknown>) => unknown,
  _afterKey: string
): Itr3LossHead[] {
  const s = obj(sched);
  const map: Array<[string, string]> = [
    ['Salary', 'Salary'],
    ['HP', 'House Property'],
    ['BusProfExclSpecProf', 'Business (non-speculative)'],
    ['SpeculativeInc', 'Speculative business'],
    ['SpecifiedInc', 'Specified business'],
    ['STCG20Per', 'STCG — 20%'],
    ['STCG30Per', 'STCG — 30%'],
    ['STCGAppRate', 'STCG — applicable rate'],
    ['STCGDTAARate', 'STCG — DTAA'],
    ['LTCG12_5Per', 'LTCG — 12.5%'],
    ['LTCGDTAARate', 'LTCG — DTAA'],
    ['OthSrcExclRaceHorse', 'Other sources (excl. race horse)'],
    ['OthSrcRaceHorse', 'Other sources (race horse)'],
    ['IncOSDTAA', 'Other sources — DTAA']
  ];
  const heads: Itr3LossHead[] = [];
  for (const [key, label] of map) {
    const node = obj(s[key]);
    const incomeCurrent = num(pickIncome(node.IncCYLA ? obj(node.IncCYLA) : node));
    const afterSetOff = num(pick(node.IncCYLA ? obj(node.IncCYLA) : node, ['IncOfCurYrAfterSetOff', 'IncOfCurYrAfterSetOffBFLosses']));
    if (incomeCurrent !== 0 || afterSetOff !== 0) {
      heads.push({ head: label, incomeCurrent, afterSetOff });
    }
  }
  return heads;
}

function buildCfLoss(sched: unknown): Itr3CfLoss[] {
  const s = obj(sched);
  const out: Itr3CfLoss[] = [];
  for (const key of Object.keys(s)) {
    const node = obj(s[key]);
    const detl = obj(node.CarryFwdLossDetail);
    const sum = obj(node.LossSummaryDetail);
    const year = key.replace(/[^0-9-]/g, '');
    const businessLoss = num(detl.BusLossOthThanSpecLossCF) || num(sum.BusLossOthThanSpecLossCF);
    const specBus = num(detl.LossFrmSpecBusCF) || num(sum.LossFrmSpecBusCF);
    const specifiedBus = num(detl.LossFrmSpecifiedBusCF) || num(sum.LossFrmSpecifiedBusCF);
    const stcg = num(detl.TotalSTCGPTILossCF) || num(sum.TotalSTCGPTILossCF);
    const ltcg = num(detl.TotalLTCGPTILossCF) || num(sum.TotalLTCGPTILossCF);
    const hp = num(detl.TotalHPPTILossCF) || num(sum.TotalHPPTILossCF);
    const os = num(detl.OthSrcLossRaceHorseCF) || num(sum.OthSrcLossRaceHorseCF);
    if (businessLoss === 0 && specBus === 0 && specifiedBus === 0 && stcg === 0 && ltcg === 0 && hp === 0 && os === 0) continue;
    out.push({
      year: year || 'CY',
      dateOfFiling: String(detl.DateOfFiling ?? ''),
      businessLoss, specBusinessLoss: specBus, specifiedBusinessLoss: specifiedBus,
      stcgLoss: stcg, ltcgLoss: ltcg, hpLoss: hp, otherSourceLoss: os
    });
  }
  return out;
}

function buildVia(viaRaw: unknown, sched80C: unknown): Itr3ChapterVia {
  const via = obj(viaRaw);
  const usr = obj(via.UsrDeductUndChapVIA);
  const ded = obj(via.DeductUndChapVIA);
  const merged = { ...ded, ...usr };

  const breakdown: Itr3ChapterVia['breakdown'] = [];
  const map: Array<[string, string]> = [
    ['Section80C', '80C'], ['Section80CCC', '80CCC'], ['Section80CCDEmployeeOrSE', '80CCD(1)'],
    ['Section80CCD1B', '80CCD(1B)'], ['Section80CCDEmployer', '80CCD(2)'], ['Section80D', '80D'],
    ['Section80DD', '80DD'], ['Section80DDB', '80DDB'], ['Section80E', '80E'], ['Section80EE', '80EE'],
    ['Section80EEA', '80EEA'], ['Section80EEB', '80EEB'], ['Section80G', '80G'], ['Section80GG', '80GG'],
    ['Section80GGA', '80GGA'], ['Section80GGC', '80GGC'], ['Section80U', '80U'], ['Section80TTA', '80TTA'],
    ['Section80TTB', '80TTB']
  ];
  for (const [key, code] of map) {
    const amount = num(merged[key]);
    if (amount > 0) breakdown.push({ code, label: `Deduction u/s ${code}`, amount });
  }

  const s80C = obj(sched80C);
  const cTotal = num(s80C.TotalAmt);
  if (cTotal > 0 && !breakdown.some((b) => b.code === '80C')) breakdown.push({ code: '80C', label: 'Deduction u/s 80C', amount: cTotal });

  const total = num(merged.TotalChapVIADeductions) || breakdown.reduce((s, b) => s + b.amount, 0);
  return { breakdown, total };
}

/* ============================================================
   Report sections
   ============================================================ */

function buildItr3ReportSections(d: Itr3Detail): ReportSection[] {
  const money = (label: string, v: Valued, highlight = false) => ({ label, value: v.value, highlight });
  const sections: ReportSection[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      summary: 'As per ITR-3 JSON — PartA_GEN1 + Verification.',
      details: [
        { label: 'Name', value: d.personal.name.toUpperCase() },
        { label: 'Father’s Name', value: d.personal.fatherName || '—' },
        { label: 'PAN', value: d.personal.pan },
        { label: 'Date of Birth', value: d.personal.dob || '—' },
        { label: 'Assessment Year', value: d.assessmentYear },
        { label: 'Financial Year', value: d.financialYear },
        { label: 'Tax Regime', value: d.regime === 'old' ? 'Old Regime' : 'New Regime (115BAC)' },
        { label: 'Residential Status', value: d.personal.residentStatus || '—' },
        { label: 'Filing Section', value: d.personal.filingSection || '—' },
        { label: 'Address', value: d.personal.address || '—' }
      ]
    },
    {
      id: 'business',
      title: 'Business / Profession',
      summary: 'As per ITR-3 PartA_GEN2 + Schedule BP.',
      details: [
        { label: 'Nature of Business', value: d.business.naturesOfBusiness.map((n) => `${n.tradeName} (${n.code})`).join(', ') || '—' },
        { label: 'Method of Accounting', value: d.business.methodOfAccounting || '—' },
        { label: 'Books of Account', value: d.business.booksOfAccount || '—' },
        money('Profit before tax (P&L)', d.business.profitBeforeTax),
        money('Balance P/L (Schedule BP)', d.business.balancePL),
        money('Depreciation allowed u/s 32', d.business.depreciation),
        money('Adjusted P/L', d.business.adjustedPL),
        money('Income chargeable under Business', d.business.incomeChargeable, true)
      ]
    }
  ];

  if (d.salary.incomeFromSalary.value !== 0 || d.salary.grossSalary.value !== 0) {
    sections.push({
      id: 'salary',
      title: 'Income from Salary',
      summary: `${d.salary.employers.length} employer(s) as per ITR-3 Schedule S.`,
      details: [
        ...d.salary.employers.map((e) => ({ label: `Employer: ${e.name}${e.tan ? ` (TAN ${e.tan})` : ''}`, value: '' })),
        money('Gross salary', d.salary.grossSalary),
        money('Exempt allowances (u/s 10)', d.salary.exemptAllowances),
        ...(d.salary.hra.present ? [
          money('HRA received (u/s 10(13A))', d.salary.hra.hraReceived),
          money('  Rent paid', d.salary.hra.rentPaid),
          money('  Exempt HRA (least of three)', d.salary.hra.eligibleExemption)
        ] : []),
        money('Net salary (after exemptions)', d.salary.netSalary),
        money('Less: Standard Deduction u/s 16(ia)', d.salary.standardDeduction16ia),
        money('Less: Professional tax u/s 16(iii)', d.salary.professionalTax16iii),
        money('Income chargeable under Salary', d.salary.incomeFromSalary, true)
      ]
    });
  }

  if (d.houseProperties.length > 0) {
    sections.push({
      id: 'houseproperty',
      title: 'Income from House Property',
      summary: `${d.houseProperties.length} property(ies) as per ITR-3 Schedule HP.`,
      details: d.houseProperties.flatMap((p, i) => [
        { label: `Property ${i + 1}${p.address ? ` — ${p.address}` : ''}${p.tenant ? ` · Tenant: ${p.tenant}` : ''}`, value: '' },
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
      summary: 'As per ITR-3 Schedule CG For 23 / 112A — short & long term.',
      details: [
        ...(d.capitalGains.stcg112A ? [money(d.capitalGains.stcg112A.label, { value: d.capitalGains.stcg112A.amount, source: 'JSON' as SourceTag })] : []),
        ...(d.capitalGains.stcgOther ? [money(d.capitalGains.stcgOther.label, { value: d.capitalGains.stcgOther.amount, source: 'JSON' as SourceTag })] : []),
        ...(d.capitalGains.ltcg112A ? [money(d.capitalGains.ltcg112A.label, { value: d.capitalGains.ltcg112A.amount, source: 'JSON' as SourceTag })] : []),
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
      summary: 'As per ITR-3 Schedule OS.',
      details: [
        ...d.otherSources.others.map((o) => money(o.label, { value: o.amount, source: 'JSON' as SourceTag })),
        money('Total Income from Other Sources', d.otherSources.total, true)
      ]
    });
  }

  sections.push({
    id: 'computation',
    title: 'Computation of Total Income & Tax',
    summary: `${d.regime === 'old' ? 'Old regime' : 'New regime (115BAC)'} — as per ITR-3 Part B.`,
    details: [
      money('Income from Salary', { value: d.income.salary, source: 'JSON' as SourceTag }),
      money('Income from House Property', { value: d.income.houseProperty, source: 'JSON' as SourceTag }),
      money('Business / Profession', { value: d.income.business, source: 'JSON' as SourceTag }),
      money('Capital Gains', { value: d.income.capitalGains, source: 'JSON' as SourceTag }),
      money('Other Sources', { value: d.income.otherSources, source: 'JSON' as SourceTag }),
      money('Gross Total Income', { value: d.income.grossTotal, source: 'JSON' as SourceTag }, true),
      money('Less: Deductions u/s 80C–80U', { value: d.via.total, source: 'JSON' as SourceTag }),
      money('Total Income (as per ITR)', { value: d.income.totalIncome, source: 'JSON' as SourceTag }),
      money('Tax on total income (normal rates)', { value: d.taxComputed.taxNormal, source: 'JSON' as SourceTag }),
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
    summary: 'As per ITR-3 Schedule IT + Part B — compared with HISAB computation.',
    details: [
      money('Advance Tax', { value: d.taxesPaid.advanceTax, source: 'JSON' as SourceTag }),
      money('TDS (Form 26AS / AIS)', { value: d.taxesPaid.tds, source: 'JSON' as SourceTag }),
      money('TCS', { value: d.taxesPaid.tcs, source: 'JSON' as SourceTag }),
      money('Self-Assessment Tax', { value: d.taxesPaid.selfAssessmentTax, source: 'JSON' as SourceTag }),
      money('Total Taxes Paid', { value: d.taxesPaid.total, source: 'JSON' as SourceTag }, true),
      money('Balance Payable (as per ITR)', { value: d.taxesPaid.balancePayable, source: 'JSON' as SourceTag }),
      money('Refund Due (as per ITR)', { value: d.refund.refundDue, source: 'JSON' as SourceTag }, true)
    ]
  });

  if (d.cfl.length > 0) {
    sections.push({
      id: 'cfl',
      title: 'Losses Carried Forward',
      summary: 'As per ITR-3 Schedule CFL.',
      details: d.cfl.flatMap((l) => [
        { label: `Carry-forward loss (AY ${l.year || '—'}${l.dateOfFiling ? `, filed ${l.dateOfFiling}` : ''})`, value: '' },
        ...(l.businessLoss ? [{ label: '  Business loss', value: l.businessLoss }] : []),
        ...(l.specBusinessLoss ? [{ label: '  Speculative business loss', value: l.specBusinessLoss }] : []),
        ...(l.stcgLoss ? [{ label: '  STCG loss', value: l.stcgLoss }] : []),
        ...(l.ltcgLoss ? [{ label: '  LTCG loss', value: l.ltcgLoss }] : [])
      ])
    });
  }

  if (d.verification.name) {
    sections.push({
      id: 'verification',
      title: 'Verification & Declaration',
      summary: 'As per ITR-3 Verification block.',
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
