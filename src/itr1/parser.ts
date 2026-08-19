import type {
  DeductionItem,
  Itr1BankDetail,
  Itr1Detail,
  Itr1HouseProperty,
  IncomeSource,
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

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
}

function num(x: unknown): number {
  return Math.round(parseNumber(x));
}

function vJSON(x: unknown): Valued {
  return { value: num(x), source: 'JSON' };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface Itr1ParseResult {
  normalized: NormalizedITR;
  issues: ValidationIssue[];
}

/* ============================================================
   ITR-1 (SAHAJ) tax computation — AY 2025-26 & AY 2026-27
   New Regime (115BAC) vs Old Regime, LTCG 112A, Rebate 87A,
   surcharge + health & education cess.
   ============================================================ */

export interface Itr1TaxResult {
  taxableIncome: number;
  taxNormal: number;
  ltcTax: number;
  rebate: number;
  surcharge: number;
  cess: number;
  grossLiability: number;
  totalTax: number;
}

export function computeItr1Tax(opts: {
  totalIncome: number;
  regime: 'new' | 'old';
  ltc112a: number;
  assessmentYear: string;
}): Itr1TaxResult {
  const { totalIncome, regime, ltc112a, assessmentYear } = opts;
  const slabs = getAYSlabSet(assessmentYear);

  // totalIncome is the ITR "Total Income" (already after Chapter VI-A for old
  // regime, and it INCLUDES LTCG 112A). LTCG is taxed separately at a special
  // rate, so it must be excluded from the normal slab base to avoid double tax.
  const taxableNormal = Math.max(0, Math.floor((totalIncome - ltc112a) / 10) * 10);
  const roundedTaxable = Math.floor(Math.max(0, totalIncome) / 10) * 10;

  let taxNormal = 0;
  let prev = 0;
  let remaining = taxableNormal;
  const slabList = regime === 'new' ? slabs.newRegime : slabs.oldRegime;
  for (const s of slabList) {
    const inSlab = Math.min(Math.max(0, remaining), s.upTo - prev);
    taxNormal += inSlab * s.rate;
    remaining -= inSlab;
    prev = s.upTo;
    if (remaining <= 0) break;
  }
  taxNormal = Math.round(taxNormal);

  const ltcTax = Math.max(0, Math.round((ltc112a - 125000) * 0.125));
  let taxBeforeRebate = taxNormal + ltcTax;

  let rebate = 0;
  if (regime === 'new') {
    if (totalIncome <= slabs.newRebate.threshold) rebate = Math.min(taxBeforeRebate, slabs.newRebate.amount);
  } else if (totalIncome <= slabs.oldRebate.threshold) {
    rebate = Math.min(taxBeforeRebate, slabs.oldRebate.amount);
  }
  rebate = Math.round(rebate);
  taxBeforeRebate = Math.max(0, taxBeforeRebate - rebate);

  const surcharge = Math.round(taxBeforeRebate * getSurchargeRateFor(totalIncome));
  const cess = Math.round((taxBeforeRebate + surcharge) * 0.04);
  const totalTax = taxBeforeRebate + surcharge + cess;

  return {
    taxableIncome: roundedTaxable,
    taxNormal,
    ltcTax,
    rebate,
    surcharge,
    cess,
    grossLiability: totalTax,
    totalTax
  };
}

function getSurchargeRateFor(income: number): number {
  if (income > 5000000) return 0.1;
  return 0;
}

/* ============================================================
   Parser
   ============================================================ */

export function parseItr1(raw: string): Itr1ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(raw).trim());
  } catch {
    throw new Error(
      'This file could not be read as JSON. Please upload the ITR export from the e-filing portal (expected structure: { "ITR": { "ITR1": { ... } } }).'
    );
  }
  return parseItr1Object(data);
}

export function parseItr1Object(input: unknown): Itr1ParseResult {
  const issues: ValidationIssue[] = [];
  const root = obj(input);
  const itr = obj(root.ITR);
  const itr1 = obj(itr.ITR1);
  if (!itr.ITR1) {
    throw new Error('This file is not an ITR-1 (SAHAJ) export.');
  }

  const formItr1 = obj(itr1.Form_ITR1);
  const personalInfo = obj(itr1.PersonalInfo);
  const assesseeName = obj(personalInfo.AssesseeName);
  const address = obj(personalInfo.Address);
  const verification = obj(itr1.Verification);
  const declaration = obj(verification.Declaration);
  const filingStatus = obj(itr1.FilingStatus);
  const incomeDed = obj(itr1.ITR1_IncomeDeductions);
  const taxRep = obj(itr1.ITR1_TaxComputation);
  const intrstPay = obj(taxRep.IntrstPay);
  const taxPaidHead = obj(itr1.TaxPaid);
  const taxesPaid = obj(taxPaidHead.TaxesPaid);
  const refund = obj(itr1.Refund);
  const bankDetailsRaw = Array.isArray(obj(refund.BankAccountDtls).AddtnlBankDetails)
    ? (obj(refund.BankAccountDtls).AddtnlBankDetails as Array<Record<string, unknown>>)
    : [];

  const firstName = String(assesseeName.FirstName ?? assesseeName.Name ?? '');
  const middleName = String(assesseeName.MiddleName ?? '');
  const surName = String(assesseeName.SurNameOrOrgName ?? '');
  const name = `${firstName} ${middleName} ${surName}`.replace(/\s+/g, ' ').trim() || 'Unknown Taxpayer';
  const pan = String(personalInfo.PAN ?? declaration.AssesseeVerPAN ?? 'ABCDE1234F').toUpperCase();

  /* ---------- Assessment / financial years ---------- */
  const ayEnd = num(formItr1.AssessmentYear) || num(personalInfo.AssessmentYear);
  let assessmentYear = String(personalInfo.AssessmentYear ?? '2025-26');
  let financialYear = String(personalInfo.FinancialYear ?? '2024-25');
  if (Number.isFinite(ayEnd) && ayEnd >= 2015 && ayEnd <= 2040) {
    assessmentYear = `${ayEnd - 1}-${String(ayEnd).slice(2)}`;
    financialYear = `${ayEnd - 2}-${String(ayEnd - 1).slice(2)}`;
  }

  /* ---------- Regime ---------- */
  const optedOut = String(filingStatus.OptOutNewTaxRegime ?? '').toUpperCase();
  const regime: 'new' | 'old' = optedOut === 'Y' ? 'old' : 'new';

  /* ---------- Salary ---------- */
  const grossSalary = vJSON(incomeDed.GrossSalary);
  const salary = vJSON(incomeDed.Salary);
  const perquisites = vJSON(incomeDed.PerquisitesValue);
  const profitsInSalary = vJSON(incomeDed.ProfitsInSalary);
  const exemptAllowances = vJSON(obj(incomeDed.AllwncExemptUs10).TotalAllwncExemptUs10);
  const netSalary = vJSON(incomeDed.NetSalary);
  const stdDed16ia = vJSON(incomeDed.DeductionUs16ia ?? incomeDed.DeductionUs16);
  const entertainment16ii = vJSON(incomeDed.EntertainmentAlw16ii);
  const profTax16iii = vJSON(incomeDed.ProfessionalTaxUs16iii);
  const reportedIncomeFromSal = num(incomeDed.IncomeFromSal);
  const calculatedIncomeFromSal = Math.max(0, grossSalary.value - exemptAllowances.value - stdDed16ia.value - entertainment16ii.value - profTax16iii.value);
  const incomeFromSalary = {
    value: reportedIncomeFromSal !== 0 ? reportedIncomeFromSal : calculatedIncomeFromSal,
    source: (reportedIncomeFromSal !== 0 && Math.abs(reportedIncomeFromSal - calculatedIncomeFromSal) <= 1)
      ? 'VERIFIED' as SourceTag
      : ('CALCULATED' as SourceTag)
  };

  /* ---------- House property (AY 2026 PropertyDetails[] or legacy flat fields) ---------- */
  const propertyDetailsRaw = Array.isArray(incomeDed.PropertyDetails) ? (incomeDed.PropertyDetails as Array<Record<string, unknown>>) : [];
  const houseProperties: Itr1HouseProperty[] = [];
  const hpRaw = obj(incomeDed);

  const legacyPropFields = {
    propertyType: '',
    address: '',
    grossRent: num(hpRaw.GrossRentReceived),
    municipalTax: num(hpRaw.TaxPaidlocalAuth),
    annualValue: num(hpRaw.AnnualValue),
    std: num(hpRaw.StandardDeduction),
    interest: num(hpRaw.InterestPayable),
    arrears: num(hpRaw.ArrearsUnrealizedRentRcvd),
    income: num(hpRaw.TotalIncomeOfHP)
  };

  const buildProperty = (src: Record<string, unknown> | typeof legacyPropFields, type: string): Itr1HouseProperty => {
    const grossRent = num(src.grossRent);
    const municipalTax = num(src.municipalTax);
    const annualValue = num(src.annualValue);
    const std30 = num(src.std);
    const interest = num(src.interest);
    const income = num(src.income);
    const calculatedIncome = Math.round(annualValue - municipalTax - std30 - interest);
    const finalHpIncome = income !== 0 ? income : calculatedIncome;
    return {
      propertyType: type || String((src as Record<string, unknown>).PropertyDetails ? '' : '') || 'Self-occupied / Other',
      address: String((src as Record<string, unknown>).AddressOfProperty ?? '') || undefined,
      grossRent: { value: grossRent, source: 'JSON' },
      municipalTax: { value: municipalTax, source: 'JSON' },
      annualValue: { value: annualValue, source: 'JSON' },
      standardDeduction: { value: std30, source: std30 !== 0 ? 'JSON' : 'CALCULATED' },
      interestOnBorrowedCapital: { value: interest, source: 'JSON' },
      arrearsUnrealizedRent: { value: num(src.arrears), source: 'JSON' },
      incomeOrLoss: {
        value: finalHpIncome,
        source: income !== 0 && Math.abs(income - calculatedIncome) <= 1 ? 'VERIFIED' : income !== 0 ? 'JSON' : 'CALCULATED'
      }
    };
  };

  if (propertyDetailsRaw.length > 0) {
    for (const p of propertyDetailsRaw) {
      const src = { ...p, grossRent: p.GrossRentReceived ?? p.GrossRentReceivedUs23, municipalTax: p.TaxPaidlocalAuth, std: p.StandardDeduction, interest: p.InterestPayable, arrears: p.ArrearsUnrealizedRentRcvd, income: p.TotalIncomeOfHP };
      houseProperties.push(buildProperty({ ...src, propertyType: String(p.PropertyDetailsApplicable ?? p.PropertyType ?? '') }, String(p.PropertyType ?? '')));
    }
  } else if (legacyPropFields.grossRent > 0 || legacyPropFields.annualValue > 0 || legacyPropFields.interest > 0 || legacyPropFields.income !== 0) {
    houseProperties.push(buildProperty(legacyPropFields, ''));
  }

  const incomeFromHP = houseProperties.reduce((sum, p) => sum + p.incomeOrLoss.value, 0);
  const housePropertyIncome: Valued = {
    value: incomeFromHP,
    source: houseProperties.every((p) => p.incomeOrLoss.source === 'VERIFIED') ? 'VERIFIED' : houseProperties.length ? 'JSON' : 'JSON'
  };

  /* ---------- Other sources ---------- */
  const otherIncList = Array.isArray(obj(incomeDed.OthersInc).OthersIncDtlsOthSrc)
    ? (obj(incomeDed.OthersInc).OthersIncDtlsOthSrc as Array<Record<string, unknown>>)
    : [];
  const savingsInterestDeduction = vJSON(incomeDed.DeductionUs57iia);
  const otherSourcesBreakdown = otherIncList.map((d) => ({
    natureCode: String(d.OthSrcNatureDesc ?? ''),
    description: String(d.OthSrcOthNatOfInc ?? 'Other Income'),
    amount: { value: num(d.OthSrcOthAmount), source: 'JSON' } as Valued
  }));
  const otherSourcesTotalCalc = otherSourcesBreakdown.reduce((s, d) => s + d.amount.value, 0);
  const reportedOtherSources = num(incomeDed.IncomeOthSrc);
  const otherSourcesTotal: Valued = {
    value: reportedOtherSources !== 0 ? reportedOtherSources : otherSourcesTotalCalc,
    source: reportedOtherSources !== 0 && Math.abs(reportedOtherSources - otherSourcesTotalCalc) <= 1
      ? 'VERIFIED'
      : reportedOtherSources !== 0 ? 'JSON' : 'CALCULATED'
  };

  /* ---------- LTCG 112A ---------- */
  const ltc112aRaw = obj(itr1.LTCG112A);
  const ltc112a: Itr1Detail['ltc112a'] = {
    saleConsideration: vJSON(ltc112aRaw.TotSaleCnsdrn),
    costOfAcquisition: vJSON(ltc112aRaw.TotCstAcqisn),
    longTermGain: vJSON(ltc112aRaw.LongCap112A)
  };
  const ltcPresent = ltc112a.longTermGain.value > 0;

  /* ---------- Agri / exempt income u/s 10 ---------- */
  const exemptIncNode = obj(incomeDed.ExemptIncAgriOthUs10);
  const exemptAgri = vJSON(exemptIncNode.ExemptIncAgriOthUs10Total);

  const exemptDetails: Itr1Detail['exemptIncomeSection10']['details'] = [];
  const exemptDtlsRaw = exemptIncNode.ExemptIncAgriOthUs10Dtls;
  const exemptDtls = Array.isArray(exemptDtlsRaw)
    ? (exemptDtlsRaw as Array<Record<string, unknown>>)
    : [];
  for (const item of exemptDtls) {
    const amount = num(item.OthAmount) ?? num(item.Amount);
    const section = String(item.SubCategory ?? item.Section ?? '').trim();
    const category = String(item.Category ?? '').trim();
    if (!amount) continue;
    const label =
      category.toUpperCase() === 'AGRI'
        ? 'Agricultural income u/s 10(1)'
        : section
          ? `Exempt income u/s ${section}`
          : 'Other exempt income u/s 10';
    exemptDetails.push({ amount, section, label });
  }
  const exemptTotal =
    exemptDetails.length > 0
      ? exemptDetails.reduce((sum, e) => sum + e.amount, 0)
      : exemptAgri.value;

  /* ---------- Chapter VI-A deductions ---------- */
  const viaRaw = obj(incomeDed.UsrDeductUndChapVIA);
  const viaRaw2 = obj(incomeDed.DeductUndChapVIA);
  const via = { ...viaRaw2, ...viaRaw };
  const viaCodes: Array<[string, string]> = [
    ['Section80C', '80C'], ['Section80CCC', '80CCC'], ['Section80CCDEmployeeOrSE', '80CCD(1)'],
    ['Section80CCD1B', '80CCD(1B)'], ['Section80CCDEmployer', '80CCD(2)'], ['Section80D', '80D'],
    ['Section80DD', '80DD'], ['Section80DDB', '80DDB'], ['Section80E', '80E'], ['Section80EE', '80EE'],
    ['Section80EEA', '80EEA'], ['Section80EEB', '80EEB'], ['Section80G', '80G'], ['Section80GG', '80GG'],
    ['Section80GGA', '80GGA'], ['Section80GGC', '80GGC'], ['Section80U', '80U'], ['Section80TTA', '80TTA'],
    ['Section80TTB', '80TTB'], ['AnyOthSec80CCH', '80CCH']
  ];
  const deductions: Itr1Detail['deductions'] = [];
  for (const [key, code] of viaCodes) {
    const amount = num(via[key]);
    if (amount > 0) {
      deductions.push({
        code,
        label: code,
        section: code,
        amount: { value: amount, source: 'JSON' }
      });
    }
  }
  const totalDeductionsValue = num(via.TotalChapVIADeductions);
  const totalDeductionsCalc = deductions.reduce((s, d) => s + d.amount.value, 0);
  const totalDeductions: Valued = {
    value: totalDeductionsValue !== 0 ? totalDeductionsValue : totalDeductionsCalc,
    source: totalDeductionsValue !== 0 && Math.abs(totalDeductionsValue - totalDeductionsCalc) <= 1
      ? 'VERIFIED'
      : totalDeductionsValue !== 0 ? 'JSON' : 'CALCULATED'
  };
  const totalDeductionsApplicable = regime === 'old' ? totalDeductions.value : 0;

  /* ---------- Income aggregates ---------- */
  const capitalGains = ltcPresent ? ltc112a.longTermGain.value : 0;
  const gtiCalculated = incomeFromSalary.value + (incomeFromHP < 0 ? 0 : incomeFromHP) + otherSourcesTotal.value + capitalGains;
  const reportedGti = num(incomeDed.GrossTotIncome);
  const reportedTotalIncome = num(incomeDed.TotalIncome);
  const gti: Valued = {
    value: reportedGti !== 0 ? reportedGti : gtiCalculated,
    source: reportedGti !== 0 && Math.abs(reportedGti - gtiCalculated) <= 1 ? 'VERIFIED' : reportedGti !== 0 ? 'JSON' : 'CALCULATED'
  };

  const taxableCalc = Math.max(0, (reportedGti !== 0 ? reportedGti : gtiCalculated) - totalDeductionsApplicable);
  const totalIncomeReported: Valued = {
    value: reportedTotalIncome,
    source: reportedTotalIncome === taxableCalc ? 'VERIFIED' : 'JSON'
  };
  const totalIncomeRounded: Valued = { value: Math.floor(taxableCalc / 10) * 10, source: 'CALCULATED' };

  /* ---------- Tax computation ---------- */
  const incomeForTax = reportedTotalIncome !== 0 ? reportedTotalIncome : taxableCalc;
  const taxResult = computeItr1Tax({
    totalIncome: incomeForTax,
    regime,
    ltc112a: ltc112a.longTermGain.value,
    assessmentYear
  });

  const interest234 = num(intrstPay.IntrstPayUs234A) + num(intrstPay.IntrstPayUs234B) + num(intrstPay.IntrstPayUs234C);
  const netPayable = Math.max(0, taxResult.totalTax + interest234 - num(taxesPaid.AdvanceTax) - num(taxesPaid.TDS) - num(taxesPaid.TCS) - num(taxesPaid.SelfAssessmentTax));

  const ltcSource: SourceTag = ltc112a.longTermGain.source;

  /* ---------- Taxes paid / refund ---------- */
  const advanceTax = vJSON(taxesPaid.AdvanceTax);
  const tdsTotal = vJSON(taxesPaid.TDS);
  const tcsTotal = vJSON(taxesPaid.TCS);
  const selfAssessment = vJSON(taxesPaid.SelfAssessmentTax);
  const totalTaxesPaidReported = num(taxesPaid.TotalTaxesPaid);
  const totalTaxesPaid = {
    value: totalTaxesPaidReported !== 0 ? totalTaxesPaidReported : advanceTax.value + tdsTotal.value + tcsTotal.value + selfAssessment.value,
    source: 'JSON' as SourceTag
  };
  const balancePayable = vJSON(taxPaidHead.BalTaxPayable);
  const refundReported = vJSON(refund.RefundDue);

  /* ---------- Bank ---------- */
  const primaryBank = bankDetailsRaw.find((b) => String(b.UseForRefund ?? '').toLowerCase() === 'true') ?? bankDetailsRaw[0] ?? {};
  const bank: Itr1BankDetail | null = primaryBank.BankName || primaryBank.BankAccountNo
    ? {
        name: String(primaryBank.BankName ?? ''),
        accountNo: String(primaryBank.BankAccountNo ?? ''),
        ifsc: String(primaryBank.IFSCCode ?? ''),
        accountType: String(primaryBank.AccountType ?? ''),
        useForRefund: String(primaryBank.UseForRefund ?? '').toLowerCase() === 'true'
      }
    : null;

  /* ---------- Personal ---------- */
  const mobileRaw = String(address.MobileNo ?? '');
  const ackNumber = String(taxRep.AckNumber ?? formItr1.AckNumber ?? '') || '—';
  const filingDate = String(taxRep.FilingDate ?? formItr1.FilingDate ?? itr1_filingDate(itr1, filingStatus)) || '—';
  const stateCodeKey = String(address.StateCode ?? '').trim().padStart(0);
  const stateName = STATE_MAP[stateCodeKey] ?? '';
  const addressParts = [
    String(address.ResidenceNo ?? ''),
    String(address.RoadOrStreet ?? ''),
    String(address.LocalityOrArea ?? ''),
    String(address.CityOrTownOrDistrict ?? ''),
    stateName,
    String(address.PinCode ?? address.PINCode ?? '')
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
  const retFileSec = num(filingStatus.ReturnFileSec);
  const filingSection = retFileSec === 11 ? '139(1) – On Time' : retFileSec > 0 ? `139(1)` : '';

  const itr1Detail: Itr1Detail = {
    form: 'ITR1',
    assessmentYear,
    financialYear,
    personal: {
      name,
      pan,
      fatherName: String(declaration.FatherName ?? '').replace(/\s+/g, ' ').trim(),
      dob: String(personalInfo.DOB ?? ''),
      aadhaar: String(personalInfo.AadhaarCardNo ?? ''),
      mobile: mobileRaw ? (mobileRaw.startsWith('+') ? mobileRaw : `+91-${mobileRaw}`) : '',
      email: String(address.EmailAddress ?? ''),
      address: fullAddress,
      city: String(address.CityOrTownOrDistrict ?? '').split(',')[0].trim(),
      state: stateName,
      pinCode: String(address.PinCode ?? address.PINCode ?? ''),
      employerCategory: String(personalInfo.EmployerCategory ?? ''),
      residentStatus: '',
      filingSection,
      returnFileSec: retFileSec,
      ackNumber,
      filingDate
    },
    salary: {
      gross: grossSalary,
      salaryComponent: salary,
      perquisites,
      profitsInSalary,
      exemptAllowances,
      netSalary,
      standardDeduction16ia: stdDed16ia,
      entertainment16ii: entertainment16ii,
      professionalTax16iii: profTax16iii,
      incomeFromSalary
    },
    houseProperties,
    otherSources: otherSourcesBreakdown,
    otherSourcesTotal,
    savingsInterestDeduction,
    exemptAgriIncome: exemptAgri,
    exemptIncomeSection10: { total: exemptTotal, details: exemptDetails },
    deductions,
    totalDeductions,
    ltc112a,
    income: {
      salary: incomeFromSalary,
      houseProperty: housePropertyIncome,
      otherSources: otherSourcesTotal,
      capitalGains: { value: capitalGains, source: ltcSource },
      grossTotalIncomeCalculated: { value: gtiCalculated, source: 'CALCULATED' },
      grossTotalIncomeReported: gti,
      totalIncomeReported,
      taxableIncomeCalculated: { value: taxableCalc, source: 'CALCULATED' },
      totalIncomeRounded
    },
    taxComputed: {
      taxOnIncomeNormal: { value: taxResult.taxNormal, source: 'CALCULATED' },
      taxOnLtc112a: { value: taxResult.ltcTax, source: 'CALCULATED' },
      rebate87A: { value: taxResult.rebate, source: 'CALCULATED' },
      surcharge: { value: taxResult.surcharge, source: 'CALCULATED' },
      educationCess: { value: taxResult.cess, source: 'CALCULATED' },
      grossTaxLiability: { value: taxResult.totalTax, source: 'CALCULATED' },
      totalTaxPayable: { value: taxResult.totalTax, source: 'CALCULATED' },
      interest234: { value: interest234, source: 'JSON' },
      netTaxPayable: { value: netPayable, source: 'CALCULATED' }
    },
    taxReported: {
      taxPayable: vJSON(taxRep.TotalTaxPayable),
      rebate87A: vJSON(taxRep.Rebate87A),
      cess: vJSON(taxRep.EducationCess),
      grossLiability: vJSON(taxRep.GrossTaxLiability),
      netLiability: vJSON(taxRep.NetTaxLiability),
      totalInterest: vJSON(taxRep.TotalIntrstPay),
      totalTaxPlusInterest: vJSON(taxRep.TotTaxPlusIntrstPay)
    },
    taxesPaid: {
      advanceTax,
      tds: tdsTotal,
      tcs: tcsTotal,
      selfAssessmentTax: selfAssessment,
      total: totalTaxesPaid,
      balancePayable
    },
    refundReported,
    bank,
    ltcPresent
  };

  if (!personalInfo.PAN) issues.push({ path: 'PersonalInfo.PAN', message: 'PAN missing from JSON.', severity: 'warning' });
  if (incomeFromSalary.source === 'CALCULATED' && grossSalary.value > 0) {
    issues.push({ path: 'ITR1_IncomeDeductions.IncomeFromSal', message: 'Income from salary reconstructed from components (computed value differs from reported).', severity: 'warning' });
  }
  if (reportedGti !== 0 && Math.abs(reportedGti - gtiCalculated) > 1) {
    issues.push({ path: 'ITR1_IncomeDeductions.GrossTotIncome', message: 'Gross total income in the ITR does not equal the sum of income heads — shown in HISAB Check.', severity: 'warning' });
  }

  /* ---------- Taxpayer (compatible shape) ---------- */
  const taxpayer: Taxpayer = {
    name,
    pan,
    assessmentYear,
    financialYear,
    type: 'other',
    regime,
    city: itr1Detail.personal.city,
    state: stateName,
    pinCode: itr1Detail.personal.pinCode,
    fatherName: itr1Detail.personal.fatherName,
    dob: itr1Detail.personal.dob,
    aadhaar: itr1Detail.personal.aadhaar,
    mobile: itr1Detail.personal.mobile,
    email: itr1Detail.personal.email,
    residentStatus: '',
    filingSection,
    address: fullAddress,
    bankName: bank?.name ?? '',
    accountNo: bank?.accountNo ?? '',
    ifsc: bank?.ifsc ?? '',
    accountType: bank?.accountType ?? '',
    refundDue: refundReported.value
  };

  const sourceRows: IncomeSource[] = [
    { code: 'SAL', label: 'Income from Salary', amount: incomeFromSalary.value, percentage: 0 },
    { code: 'HP', label: 'Income from House Property', amount: incomeFromHP, percentage: 0 },
    { code: 'OS', label: 'Income from Other Sources', amount: otherSourcesTotal.value, percentage: 0 },
    { code: 'CG', label: 'Capital Gains (112A)', amount: capitalGains, percentage: 0 }
  ].filter((s) => s.amount !== 0);
  const gtiDisplay = gti.value !== 0 ? gti.value : gtiCalculated;
  sourceRows.forEach((s) => { s.percentage = gtiDisplay > 0 ? (s.amount / gtiDisplay) * 100 : 0; });

  /* ---------- Report sections ---------- */
  const reportSections: ReportSection[] = buildItr1ReportSections(itr1Detail, regime);

  const taxComputation = {
    regime,
    grossTotalIncome: gtiDisplay,
    deductions: deductions.map((d) => ({ code: d.code, label: d.code, amount: d.amount.value, section: d.section }) as DeductionItem),
    totalDeductions: totalDeductionsApplicable,
    taxableIncome: taxResult.taxableIncome,
    taxBeforeCess: taxResult.taxNormal + taxResult.ltcTax - taxResult.rebate,
    surcharge: taxResult.surcharge,
    healthCess: taxResult.cess,
    rebate: taxResult.rebate,
    totalTax: taxResult.totalTax,
    advanceTax: advanceTax.value,
    tds: tdsTotal.value,
    selfAssessmentTax: selfAssessment.value,
    netTaxPayable: netPayable,
    effectiveRate: gtiDisplay > 0 ? (taxResult.totalTax / gtiDisplay) * 100 : 0
  };

  const normalized: NormalizedITR = {
    taxpayer,
    itrForm: 'ITR1',
    itr1: itr1Detail,
    incomeBreakdown: {
      businessIncome: 0,
      capitalGains,
      otherSources: otherSourcesTotal.value,
      total: gtiDisplay,
      grossReceipts: 0,
      sources: sourceRows
    },
    expenseSummary: { total: 0, items: [] },
    depreciation: { totalDepreciation: 0, assets: [] },
    taxComputation,
    reportSections,
    computedAt: new Date().toISOString()
  };

  return { normalized, issues };
}

function itr1_filingDate(itr1: Record<string, unknown>, filingStatus: Record<string, unknown>): string {
  const due = String(filingStatus.ItrFilingDueDate ?? '');
  if (due) return due;
  const ci = obj(itr1.CreationInfo);
  return String(ci.JSONCreationDate ?? '') || '';
}

function buildItr1ReportSections(d: Itr1Detail, regime: 'new' | 'old'): ReportSection[] {
  const money = (label: string, v: Valued, highlight = false) => ({ label, value: v.value, highlight });
  const sections: ReportSection[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      summary: 'As per ITR-1 JSON — PersonalInfo + Verification.',
      details: [
        { label: 'Name', value: d.personal.name.toUpperCase() },
        { label: 'Father’s Name', value: d.personal.fatherName || '—' },
        { label: 'PAN', value: d.personal.pan },
        { label: 'Date of Birth', value: d.personal.dob || '—' },
        { label: 'Assessment Year', value: d.assessmentYear },
        { label: 'Financial Year', value: d.financialYear },
        { label: 'Tax Regime', value: regime === 'new' ? 'New Regime (115BAC)' : 'Old Regime' },
        { label: 'Filing Section', value: d.personal.filingSection || '—' },
        { label: 'Address', value: d.personal.address || '—' }
      ]
    },
    {
      id: 'salary',
      title: 'Income from Salary',
      summary: 'Salary income as per ITR-1 ITR1_IncomeDeductions.',
      details: [
        money('Gross Salary', d.salary.gross),
        money('Exempt allowances (u/s 10)', d.salary.exemptAllowances),
        money('Standard Deduction (u/s 16)', d.salary.standardDeduction16ia),
        money('Entertainment Allowance (u/s 16(ii))', d.salary.entertainment16ii),
        money('Professional Tax (u/s 16(iii))', d.salary.professionalTax16iii),
        money('Income chargeable under Salary', d.salary.incomeFromSalary, true)
      ]
    }
  ];

  if (d.houseProperties.length > 0) {
    sections.push({
      id: 'houseproperty',
      title: 'Income from House Property',
      summary: `${d.houseProperties.length} property(ies) as per ITR-1${d.houseProperties.length > 1 ? ' — each handled separately.' : '.'}`,
      details: d.houseProperties.flatMap((p, i) => [
        { label: `Property ${i + 1} — ${p.propertyType || 'Residential'}`, value: '' },
        money('  Gross rent received', p.grossRent),
        money('  Municipal taxes', p.municipalTax),
        money('  Net Annual Value', { value: p.annualValue.value - p.municipalTax.value, source: 'CALCULATED' as SourceTag }),
        money('  Deduction u/s 24(b) — interest on borrowed capital', p.interestOnBorrowedCapital),
        money('  Income / Loss from House Property', p.incomeOrLoss, true)
      ])
    });
  }

  sections.push({
    id: 'othersources',
    title: 'Income from Other Sources',
    summary: 'Breakdown as per ITR-1 OthersInc.',
    details: [
      ...d.otherSources.map((o) => money(o.description || o.natureCode || 'Other Income', o.amount)),
      money('Total Income from Other Sources', d.otherSourcesTotal, true),
      money('Less: Deduction u/s 80TTA/80TTB (savings interest)', d.savingsInterestDeduction),
      money('Income chargeable from Other Sources', { value: Math.max(0, d.otherSourcesTotal.value - d.savingsInterestDeduction.value), source: 'CALCULATED' as SourceTag })
    ]
  });

  if (d.ltcPresent) {
    sections.push({
      id: 'capitalgains',
      title: 'Capital Gains (LTCG u/s 112A)',
      summary: 'Long-term capital gains on equity as per ITR-1 LTCG112A.',
      details: [
        money('Full value of consideration', d.ltc112a.saleConsideration),
        money('Less: Cost of acquisition', d.ltc112a.costOfAcquisition),
        money('Long-term capital gain', d.ltc112a.longTermGain, true)
      ]
    });
  }

  if (d.exemptIncomeSection10.total > 0) {
    sections.push({
      id: 'exemptions',
      title: 'Section 10 Exempt Income',
      summary: 'Exempt income reported under Section 10 of the Income-tax Act — not chargeable to tax.',
      details: [
        ...d.exemptIncomeSection10.details.map((e) => ({ label: e.label, value: e.amount })),
        { label: 'Total Exempt Income (u/s 10)', value: d.exemptIncomeSection10.total, highlight: true },
        { label: 'Note', value: 'Exempt income is excluded from tax, but is considered for rate purposes when aggregating income.' }
      ]
    });
  }

  sections.push({
    id: 'computation',
    title: 'Computation of Total Income & Tax',
    summary: 'Income aggregation and tax on total income.',
    details: [
      money('Income from Salary', d.income.salary),
      money('Income from House Property', d.income.houseProperty),
      money('Income from Other Sources', d.income.otherSources),
      ...(d.ltcPresent ? [money('Capital Gains (112A)', d.income.capitalGains)] : []),
      ...(d.exemptAgriIncome.value > 0 ? [money('Agricultural / Exempt income (u/s 10)', d.exemptAgriIncome)] : []),
      money('Gross Total Income', d.income.grossTotalIncomeReported, true),
      money('Less: Deductions (Chapter VI-A) — New Regime nil' , { value: regime === 'old' ? d.totalDeductions.value : 0, source: (regime === 'old' ? d.totalDeductions.source : 'CALCULATED') as SourceTag }),
      money('Total Income (as per ITR)', d.income.totalIncomeReported),
      money('Taxable Income (HISAB calculation)', d.income.taxableIncomeCalculated, true),
      money('Tax on income (normal rates)', d.taxComputed.taxOnIncomeNormal),
      ...(d.ltcPresent ? [money('Tax on LTCG 112A @12.5% (excl. ₹1,25,000)', d.taxComputed.taxOnLtc112a)] : []),
      money('Less: Rebate u/s 87A', d.taxComputed.rebate87A),
      money('Surcharge', d.taxComputed.surcharge),
      money('Health & Education Cess (4%)', d.taxComputed.educationCess),
      money('Total Tax (HISAB)', d.taxComputed.grossTaxLiability, true),
      money('Add: Interest u/s 234A/B/C', d.taxComputed.interest234),
      money('Net Tax Payable (HISAB)', d.taxComputed.netTaxPayable, true)
    ]
  });

  sections.push({
    id: 'taxespaid',
    title: 'Taxes Paid & Refund / Payable',
    summary: 'Prepaid taxes as per ITR-1 TaxPaid.',
    details: [
      money('Advance Tax', d.taxesPaid.advanceTax),
      money('TDS (Form 26AS / AIS)', d.taxesPaid.tds),
      money('TCS', d.taxesPaid.tcs),
      money('Self-Assessment Tax', d.taxesPaid.selfAssessmentTax),
      money('Total Taxes Paid', d.taxesPaid.total, true),
      money('Balance Payable (as per ITR)', d.taxesPaid.balancePayable),
      money('Refund Due (as per ITR)', d.refundReported, true)
    ]
  });

  return sections;
}