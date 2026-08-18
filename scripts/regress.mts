import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItr4Object } from '../src/parser/itr4Parser';
import { parseItr1Object } from '../src/itr1/parser';
import { buildItr1Report } from '../src/itr1/report';
import { buildItr1Pdf } from '../src/itr1/pdf';
import { detectITRForm } from '../src/itr/detectForm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WRITE_MODE = !process.argv.includes('--compare');

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

interface Snap {
  file: string;
  form: string;
  name: string;
  pan: string;
  assessmentYear: string;
  regime: string;
  income: Record<string, number>;
  deductions: Array<{ code: string; amount: number }>;
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeCess: number;
  rebate: number;
  cess: number;
  totalTax: number;
  tds: number;
  advanceTax: number;
  selfAssessmentTax: number;
  netTaxPayable: number;
  detail: Record<string, unknown>;
  reportIds: string[];
  issues: string[];
  error?: string;
}

const emptySnap = (file: string, form: string, error: string): Snap => ({
  file, form, error, name: '', pan: '', assessmentYear: '', regime: '',
  income: {}, deductions: [], totalDeductions: 0, taxableIncome: 0, taxBeforeCess: 0,
  rebate: 0, cess: 0, totalTax: 0, tds: 0, advanceTax: 0, selfAssessmentTax: 0,
  netTaxPayable: 0, detail: {}, reportIds: [], issues: []
});

function snapshot4(data: unknown, file: string): Snap {
  try {
    const { normalized, issues } = parseItr4Object(data);
    return {
      file,
      form: 'ITR4',
      name: normalized.taxpayer.name,
      pan: normalized.taxpayer.pan,
      assessmentYear: normalized.taxpayer.assessmentYear,
      regime: normalized.taxpayer.regime,
      income: {
        businessIncome: normalized.incomeBreakdown.businessIncome,
        capitalGains: normalized.incomeBreakdown.capitalGains,
        otherSources: normalized.incomeBreakdown.otherSources,
        total: normalized.incomeBreakdown.total,
        grossReceipts: normalized.incomeBreakdown.grossReceipts
      },
      deductions: normalized.taxComputation.deductions.map((d) => ({ code: d.code, amount: d.amount })),
      totalDeductions: normalized.taxComputation.totalDeductions,
      taxableIncome: normalized.taxComputation.taxableIncome,
      taxBeforeCess: normalized.taxComputation.taxBeforeCess,
      rebate: normalized.taxComputation.rebate,
      cess: normalized.taxComputation.healthCess,
      totalTax: normalized.taxComputation.totalTax,
      tds: normalized.taxComputation.tds,
      advanceTax: normalized.taxComputation.advanceTax,
      selfAssessmentTax: normalized.taxComputation.selfAssessmentTax,
      netTaxPayable: normalized.taxComputation.netTaxPayable,
      detail: {
        taxesPaid: normalized.detail?.taxesPaid ?? {},
        interest: normalized.detail?.interest ?? {},
        turnoverBanking: normalized.detail?.turnoverBanking ?? 0,
        turnoverCash: normalized.detail?.turnoverCash ?? 0,
        declaredBanking: normalized.detail?.declaredBanking ?? 0,
        declaredCash: normalized.detail?.declaredCash ?? 0
      },
      reportIds: normalized.reportSections.map((s) => s.id),
      issues: issues.map((i) => i.message)
    };
  } catch (e) {
    return emptySnap(file, 'ITR4', e instanceof Error ? e.message : String(e));
  }
}

function snapshot1(data: unknown, file: string): Snap {
  try {
    const { normalized, issues } = parseItr1Object(data);
    const d = normalized.itr1!;
    const report = buildItr1Report(normalized);
    return {
      file,
      form: 'ITR1',
      name: normalized.taxpayer.name,
      pan: normalized.taxpayer.pan,
      assessmentYear: normalized.taxpayer.assessmentYear,
      regime: normalized.taxpayer.regime,
      income: {
        salary: d.income.salary.value,
        houseProperty: d.income.houseProperty.value,
        otherSources: d.income.otherSources.value,
        capitalGains: d.income.capitalGains.value,
        gtiCalculated: d.income.grossTotalIncomeCalculated.value,
        gtiReported: d.income.grossTotalIncomeReported.value,
        totalIncomeReported: d.income.totalIncomeReported.value,
        taxableCalculated: d.income.taxableIncomeCalculated.value
      },
      deductions: d.deductions.map((x) => ({ code: x.code, amount: x.amount.value })),
      totalDeductions: d.totalDeductions.value,
      taxableIncome: d.income.totalIncomeRounded.value,
      taxBeforeCess: d.taxComputed.taxOnIncomeNormal.value + d.taxComputed.taxOnLtc112a.value - d.taxComputed.rebate87A.value,
      rebate: d.taxComputed.rebate87A.value,
      cess: d.taxComputed.educationCess.value,
      totalTax: d.taxComputed.grossTaxLiability.value,
      tds: d.taxesPaid.tds.value,
      advanceTax: d.taxesPaid.advanceTax.value,
      selfAssessmentTax: d.taxesPaid.selfAssessmentTax.value,
      netTaxPayable: d.taxComputed.netTaxPayable.value,
      detail: {
        hpCount: d.houseProperties.length,
        salarySource: d.salary.incomeFromSalary.source,
        otherSourcesTotal: d.otherSourcesTotal.value,
        savingsInterestDeduction: d.savingsInterestDeduction.value,
        exemptAgri: d.exemptAgriIncome.value,
        refundReported: d.refundReported.value,
        balancePayable: d.taxesPaid.balancePayable.value,
        taxesPaidTotal: d.taxesPaid.total.value,
        taxReportedGross: d.taxReported.grossLiability.value,
        taxReportedNet: d.taxReported.netLiability.value,
        ltcPresent: d.ltcPresent,
        ltcGain: d.ltc112a.longTermGain.value,
        bankIfsc: d.bank?.ifsc ?? '',
        filingSection: d.personal.filingSection,
        ackNumber: d.personal.ackNumber,
        filingDate: d.personal.filingDate,
        reportChecks: report.hisabCheck.length,
        allPass: report.checksAllPass
      },
      reportIds: normalized.reportSections.map((s) => s.id),
      issues: issues.map((i) => i.message)
    };
  } catch (e) {
    return emptySnap(file, 'ITR1', e instanceof Error ? e.message : String(e));
  }
}

const fixtures = fs
  .readdirSync(path.join(HERE, '..', '..', 'test-data'))
  .filter((f) => f.endsWith('.json'))
  .sort();

const snaps: Snap[] = [];
for (const file of fixtures) {
  const raw = fs.readFileSync(path.join(HERE, '..', '..', 'test-data', file), 'utf8');
  let data: unknown = null;
  try {
    data = JSON.parse(stripBom(raw));
  } catch {
    snaps.push(emptySnap(file, 'UNKNOWN', 'invalid JSON'));
    continue;
  }
  const form = detectITRForm(data);
  if (form === 'ITR1') snaps.push(snapshot1(data, file));
  else if (form === 'ITR3') snaps.push(emptySnap(file, 'ITR3', 'ITR-3 unsupported'));
  else snaps.push(snapshot4(data, file));
}

function compareGroup(actual: Snap[], label: string, expectedFile: string): number {
  const expectedPath = path.join(HERE, '..', '..', 'scripts', expectedFile);
  if (!fs.existsSync(expectedPath)) {
    console.log(`[${label}] no baseline ${expectedFile} — treat as new`);
    return 0;
  }
  const expected: Snap[] = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  let diffs = 0;
  const maxLen = Math.max(actual.length, expected.length);
  for (let i = 0; i < maxLen; i++) {
    const a = actual[i];
    const e = expected[i];
    if (!a && !e) continue;
    if (!a || !e) { diffs++; console.log(`[${label}] entry ${i}: count mismatch`); continue; }
    const same = JSON.stringify(a) === JSON.stringify(e);
    if (!same) {
      diffs++;
      console.log(`[${label}] ${a.file} (${a.name}) DIFFERS from baseline`);
    }
  }
  return diffs;
}

if (WRITE_MODE) {
  const itr4 = snaps.filter((s) => s.form === 'ITR4');
  const itr1 = snaps.filter((s) => s.form === 'ITR1');
  fs.writeFileSync(path.join(HERE, '..', '..', 'scripts', 'expected-itr4-baseline.json'), JSON.stringify(itr4, null, 1));
  fs.writeFileSync(path.join(HERE, '..', '..', 'scripts', 'expected-itr1-baseline.json'), JSON.stringify(itr1, null, 1));
  console.log(`Wrote ITR-4 baseline (${itr4.length}) + ITR-1 baseline (${itr1.length})`);
} else {
  const d4 = compareGroup(snaps.filter((s) => s.form === 'ITR4'), 'ITR4', 'expected-itr4-baseline.json');
  const d1 = compareGroup(snaps.filter((s) => s.form === 'ITR1'), 'ITR1', 'expected-itr1-baseline.json');
  console.log(`ITR-4 diffs: ${d4} | ITR-1 diffs: ${d1}`);
  if (d4 > 0) process.exitCode = 1;
}

console.log('form   | file | name | ay | regime | income | taxable | tax | net | hp | notes');
for (const s of snaps) {
  const hp = s.form === 'ITR1' ? String(s.detail.hpCount ?? '-') : '-';
  const notes = s.error ? 'ERROR: ' + s.error : s.issues.length ? s.issues.slice(0, 2).join(' ; ') : '';
  console.log(
    `${String(s.form).padEnd(5)} | ${s.file} | ${s.name} | ${s.assessmentYear} | ${s.regime} | income=${s.income.total ?? s.income.gtiReported ?? 0} taxable=${s.taxableIncome} tax=${s.totalTax} net=${s.netTaxPayable} | hp=${hp}${notes ? ' | ' + notes : ''}`
  );
}

async function pdfSmoke(): Promise<void> {
  const target = process.argv.find((a) => a.startsWith('--pdf-target='))?.split('=')[1] ?? 'SYNTHETIC_ITR1_AY2026_salary_hp.json';
  const raw = fs.readFileSync(path.join(HERE, '..', '..', 'test-data', target), 'utf8');
  const { normalized } = parseItr1Object(JSON.parse(stripBom(raw)));

  const fontsDir = path.join(HERE, '..', '..', 'public', 'fonts');
  const publicDir = path.join(fontsDir, '..');
  globalThis.document = { baseURI: new URL('file://' + publicDir.replace(/\\/g, '/') + '/').href } as unknown as Document;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = String(input);
    const name = u.split('/fonts/').pop() ?? '';
    const buf = fs.readFileSync(path.join(fontsDir, name));
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return { ok: true, status: 200, arrayBuffer: async () => arrayBuffer } as Response;
  }) as typeof fetch;

  const doc = await buildItr1Pdf(normalized);
  const pages = doc.getNumberOfPages();
  const bytes = Buffer.byteLength(doc.output('arraybuffer')) > 0 ? 'ok' : 'empty';
  console.log(`PDF SMOKE: ${target} -> ${pages} page(s), output ${bytes}`);
}

if (process.argv.includes('--pdf-smoke')) {
  void pdfSmoke().catch((e) => {
    console.log('PDF SMOKE ERROR: ' + (e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  });
}