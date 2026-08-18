import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NormalizedITR } from '../types';
import type { CompareResult } from '../calculation/comparisonEngine';
import { formatINR } from '../utils/currency';
import { ReportGenerator, type ReportData } from '../reports/reportGenerator';
import { ensureRupeeFont } from './fonts';

const INK: [number, number, number] = [26, 27, 34];
const MUTED: [number, number, number] = [122, 118, 126];
const GOLD: [number, number, number] = [184, 139, 58];
const GOLD_DARK: [number, number, number] = [212, 168, 84];
const PAPER: [number, number, number] = [247, 246, 243];
const DARK: [number, number, number] = [28, 26, 24];
const GREEN: [number, number, number] = [21, 128, 61];
const RED: [number, number, number] = [185, 28, 28];

export interface PdfOptions {
  fileName?: string;
  includeCover?: boolean;
  prev?: NormalizedITR | null;
}

const MARGIN = 48;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildPdf(normalized: NormalizedITR, _options: PdfOptions = {}, initDoc?: jsPDF): Promise<jsPDF> {
  const report = new ReportGenerator().generate(normalized);
  const doc = initDoc ?? new jsPDF({ unit: 'pt', format: 'a4' });
  await ensureRupeeFont(doc);

  let y = renderHeader(doc, report);

  y = flowHead(doc, y, 'Section 1', 'Personal Information', 'As per ITR-4 JSON — PersonalInfo + Verification');
  y = kvTable(doc, y, section1Rows(report), { twoCol: true });

  y = flowHead(doc, y, 'Section 2', 'Business Information', 'As per ITR-4 Schedule BP — Nature of Business (44AD)');
  y = kvTable(doc, y, section2Rows(report), { twoCol: true });

  y = flowHead(doc, y, 'Section 3', 'Business Income — Section 44AD (Presumptive)', 'Schedule BP · PersumptiveInc44AD · 6% on banking / 8% on cash');
  y = renderSection3(doc, report, y);

  y = flowHead(doc, y, 'Section 4', 'Computation of Tax', `${report.header.regime} · Part B (Income) + Part C (Deductions) + Part D (Tax)`, 800);
  y = renderSection4(doc, report, y);

  y = flowHead(doc, y, 'Section 5', 'Trading Account & Profit and Loss', 'Reconstructed from return data · 44AD presumptive income is the net profit');
  y = renderSection5(doc, report, y);

  y = flowHead(doc, y, 'Section 6', `Balance Sheet as at 31st March ${bsCloseYear(report.header.financialYear)}`, `${report.header.name} · PAN ${report.header.pan} · Schedule BP — FinancialParticularsOfBusiness`);
  y = renderSection6(doc, report, y);

  y = flowHead(doc, y, 'Section 7', 'Hisab Check — Return vs Calculation', 'Cross-checks between the ITR record and this working file');
  y = renderSection7(doc, report, y);

  y = flowHead(doc, y, 'Declaration', 'Verification & Declaration', 'As per ITR-4 Verification block');
  y = renderDeclaration(doc, report, y);

  renderFooter(doc);
  return doc;
}

export async function generatePdf(normalized: NormalizedITR, options: PdfOptions = {}): Promise<void> {
  const doc = await buildPdf(normalized, options);
  const fileName =
    options.fileName ?? `HISAB_${normalized.taxpayer.pan}_${normalized.taxpayer.assessmentYear.replace('-', '_')}.pdf`;
  doc.save(fileName);
}

/* ================= helpers ================= */

function fmt(v: number): string {
  return formatINR(v, { noDecimals: true });
}

function dash(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return '—';
  return String(v);
}

const tableBase = {
  margin: { left: MARGIN, right: MARGIN },
  styles: { font: 'Roboto', fontSize: 9.5, textColor: INK as unknown as string, cellPadding: 7 },
  headStyles: { fillColor: DARK as unknown as string, textColor: [255, 255, 255] as unknown as string, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: PAPER as unknown as string }
} as const;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 70) {
    doc.addPage();
    y = 56;
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(2);
    doc.line(MARGIN, 42, PAGE_W - MARGIN, 42);
  }
  return y;
}

function flowHead(doc: jsPDF, y: number, label: string, title: string, sub?: string, reserve = 420): number {
  y = ensureSpace(doc, y, reserve);

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(label.toUpperCase(), MARGIN, y);

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(title, MARGIN, y + 13);

  if (sub) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(sub, MARGIN, y + 26);
  }

  doc.setDrawColor(215, 210, 200);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 32, PAGE_W - MARGIN, y + 32);
  return y + 46;
}

function miniHead(doc: jsPDF, y: number, text: string): number {
  y = ensureSpace(doc, y, 220);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(text.toUpperCase(), MARGIN, y);
  return y + 12;
}

function kvTable(doc: jsPDF, startY: number, rows: Array<[string, string | number]>, opts: { twoCol?: boolean } = {}): number {
  let body: Array<string[]> = rows.map(([k, v]) => [k, String(v)]);
  if (opts.twoCol) {
    const paired: string[][] = [];
    for (let i = 0; i < body.length; i += 2) {
      const a = body[i];
      const b = body[i + 1] ?? ['', ''];
      paired.push([a[0], a[1], b[0], b[1]]);
    }
    body = paired;
  }
  autoTable(doc, {
    startY,
    body,
    ...tableBase,
    styles: { ...tableBase.styles, fontSize: 9, cellPadding: 6 },
    columnStyles: opts.twoCol
      ? { 0: { cellWidth: CONTENT_W * 0.19 }, 1: { cellWidth: CONTENT_W * 0.31 }, 2: { cellWidth: CONTENT_W * 0.19 }, 3: { cellWidth: CONTENT_W * 0.31 } }
      : { 0: { cellWidth: CONTENT_W * 0.38, fontStyle: 'bold', textColor: [70, 70, 78] as unknown as string }, 1: {} }
  });
  return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 14;
}

function moneyTable(
  doc: jsPDF,
  startY: number,
  head: string[],
  body: string[][],
  opts: { boldIndex?: number[]; highlightIndex?: number[]; colWidths?: number[] } = {}
): number {
  const colStyles: Record<number, { cellWidth?: number }> = {};
  if (opts.colWidths) {
    opts.colWidths.forEach((w, i) => {
      colStyles[i] = { cellWidth: w };
    });
  }
  autoTable(doc, {
    startY,
    head: [head],
    body,
    ...tableBase,
    columnStyles: colStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && (opts.boldIndex ?? []).includes(data.row.index)) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && (opts.highlightIndex ?? []).includes(data.row.index)) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [244, 238, 222] as unknown as string;
        data.cell.styles.textColor = GOLD_DARK as unknown as string;
      }
    }
  });
  return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 14;
}

function statusLine(doc: jsPDF, y: number, ok: boolean, msg: string): number {
  y = ensureSpace(doc, y, 30);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(ok ? GREEN[0] : RED[0], ok ? GREEN[1] : RED[1], ok ? GREEN[2] : RED[2]);
  doc.text(`${ok ? 'OK' : 'CHECK'}  ${msg}`, MARGIN, y);
  return y + 14;
}

function footerNote(doc: jsPDF, y: number, text: string): number {
  y = ensureSpace(doc, y, 34);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 11 + 6;
}

function bsCloseYear(fy: string): string {
  const tail = fy.slice(5, 7);
  return tail ? `20${tail}` : fy.slice(0, 4);
}

/* ================= Header block ================= */

function renderHeader(doc: jsPDF, r: ReportData): number {
  const h = r.header;
  const p = r.personalInfo;

  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, PAGE_W, 74, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 0, 5, 74, 'F');

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('WORKING FILE — COMPUTATION OF INCOME & TAX', MARGIN, 34);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 190, 175);
  doc.text(`${h.name.toUpperCase()}  ·  PAN ${h.pan}  ·  AY ${h.assessmentYear}  ·  FY ${h.financialYear}  ·  ${h.itrType.toUpperCase()}`, MARGIN, 54);

  const facts: Array<[string, string | number]> = [
    ['Name', h.name.toUpperCase()],
    ['Father’s Name', dash(p.fatherName)],
    ['PAN', h.pan],
    ['Date of Birth', dash(p.dob)],
    ['Aadhaar', dash(p.aadhaar)],
    ['Residential Status', p.residentialStatus.toUpperCase()],
    ['Filing Section', dash(p.filingSection)],
    ['Tax Regime', h.regime],
    ['Assessment Year', h.assessmentYear],
    ['Financial Year', h.financialYear],
    ['Acknowledgement No.', dash(p.ackNumber)],
    ['Filing Date', dash(p.filingDate)]
  ];
  return kvTable(doc, 96, facts, { twoCol: true });
}

function section1Rows(r: ReportData): Array<[string, string | number]> {
  const p = r.personalInfo;
  return [
    ['Full Name', p.fullName.toUpperCase()],
    ['Father’s Name', dash(p.fatherName)],
    ['PAN', p.pan],
    ['Date of Birth', dash(p.dob)],
    ['Aadhaar Number', dash(p.aadhaar)],
    ['Mobile', dash(p.mobile)],
    ['Email', dash(p.email)],
    ['Residential Status', p.residentialStatus.toUpperCase()],
    ['Address', dash(p.address)],
    ['ITR Form', p.itrForm],
    ['Tax Regime', p.taxRegime],
    ['Filing Section', dash(p.filingSection)],
    ['Assessment Year', p.assessmentYear],
    ['Financial Year', p.financialYear],
    ['Acknowledgement No.', dash(p.ackNumber)],
    ['Date of Filing', dash(p.filingDate)]
  ];
}

function section2Rows(r: ReportData): Array<[string, string | number]> {
  const b = r.businessInfo;
  return [
    ['Name of Business', dash(b.name)],
    ['Business Code', dash(b.code)],
    ['Nature of Business', dash(b.nature)],
    ['Business Profile', b.profile],
    ['Section Applied', b.sectionApplied],
    ['Books of Account', b.booksOfAccount],
    ['Tax Regime', b.taxRegime],
    ['Bank Name', dash(b.bankName)],
    ['Account No.', dash(b.accountNo)],
    ['IFSC Code', dash(b.ifscCode)],
    ['Account Type', dash(b.accountType)],
    ['Refund Due', b.refundDue]
  ];
}

/* ================= Section 3 ================= */

function renderSection3(doc: jsPDF, r: ReportData, y: number): number {
  const bi = r.businessIncome;
  const np = bi.npPercentage.toFixed(2);

  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Rate', 'Minimum / Declared', 'Total (₹)'],
    [
      ['Turnover — Banking receipts (E1a)', '6%', '—', fmt(bi.turnover.banking)],
      ['Turnover — Cash receipts (E1b)', '8%', '—', fmt(bi.turnover.cash)],
      ['Total Gross Turnover (E1)', '—', '—', fmt(bi.turnover.total)],
      ['Minimum income — 6% of banking receipts', '6%', '—', fmt(bi.minimum.sixPercent)],
      ['Minimum income — 8% of cash receipts', '8%', '—', fmt(bi.minimum.eightPercent)],
      ['Total minimum income (floor)', '—', '—', fmt(bi.minimum.total)],
      ['Declared income on banking (E2a)', '—', '—', fmt(bi.declared.banking)],
      ['Declared income on cash (E2b)', '—', '—', fmt(bi.declared.cash)],
      ['TOTAL DECLARED INCOME (E2c = E8 = B1)', '—', '—', fmt(bi.declared.total)]
    ],
    {
      boldIndex: [2, 5, 8],
      highlightIndex: [8],
      colWidths: [CONTENT_W * 0.52, CONTENT_W * 0.12, CONTENT_W * 0.2, CONTENT_W * 0.16]
    }
  );

  y = statusLine(
    doc,
    y,
    bi.declared.total >= bi.minimum.total,
    `Net Profit % = ${np}% of turnover  |  Declared income ${bi.declared.total >= bi.minimum.total ? 'meets' : 'is below'} the 44AD minimum of ${fmt(bi.minimum.total)}`
  );
  return y;
}

/* ================= Section 4 ================= */

function renderSection4(doc: jsPDF, r: ReportData, y: number): number {
  const tc = r.taxComputation;
  const sched = tc.incomeSchedule;

  y = miniHead(doc, y, 'Income Schedule (Part B of ITR-4)');
  const schedule: Array<[string, string]> = [
    ['Income from Salary (B2)', '0'],
    ['Income from House Property (B3)', '0'],
    [`Business Income u/s ${r.businessInfo.sectionApplied.startsWith('44AD') ? '44AD' : '44ADA'} (B1 = E8 = E2c)`, fmt(sched.business)]
  ];
  if (sched.otherSources > 0) {
    schedule.push(['Income from Other Sources (B4)', fmt(sched.otherSources)]);
    if (sched.savingsInterest > 0) schedule.push(['   — of which: Savings / Interest', fmt(sched.savingsInterest)]);
    if (sched.otherIncome > 0) schedule.push(['   — of which: Other', fmt(sched.otherIncome)]);
  }
  schedule.push(['Gross Total Income (B5)', fmt(sched.grossTotal)]);
  schedule.push([`Less: Deductions u/s 80C–80U (C19)${r.header.regime.startsWith('New') ? ' — Nil under New Regime' : ''}`, fmt(sched.deductions)]);
  schedule.push(['Total / Taxable Income (C20)', fmt(sched.totalIncome)]);
  schedule.push(['Taxable Income (Rounded Off)', fmt(Math.floor(sched.totalIncome / 10) * 10)]);
  y = moneyTable(doc, y, ['Particulars', 'Amount (₹)'], schedule, {
    boldIndex: [schedule.length - 2, schedule.length - 1],
    highlightIndex: [schedule.length - 1],
    colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38]
  });

  y = miniHead(doc, y, 'Tax on Income (Part D)');
  const compTax: Array<[string, string]> = [
    ['Tax on Total Income (normal rates)', fmt(tc.taxDetails.taxOnIncome)],
    ['Surcharge', fmt(tc.taxDetails.surcharge)],
    ['Health & Education Cess (4%)', fmt(tc.taxDetails.cess)],
    ['Gross Tax Liability', fmt(tc.taxDetails.grossLiability)],
    ['Less: Rebate u/s 87A (max ₹25,000)', fmt(tc.taxDetails.rebate)],
    ['Total Tax Payable', fmt(Math.max(0, tc.taxDetails.grossLiability - tc.taxDetails.rebate))],
    ['Add: Interest u/s 234A / 234B / 234C', tc.taxDetails.interest > 0 ? fmt(tc.taxDetails.interest) : '—'],
    ['Net Tax Payable (as per ITR)', fmt(tc.taxDetails.netPayable)]
  ];
  y = moneyTable(doc, y, ['Particulars', 'Amount (₹)'], compTax, {
    boldIndex: [5, 7],
    highlightIndex: [7],
    colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38]
  });

  y = miniHead(doc, y, 'Taxes Paid & Refund (Part D)');
  const paid = tc.taxPaid;
  const paidRows: Array<[string, string]> = [
    ['Advance Tax', fmt(paid.advanceTax)],
    ['TDS (Form 26AS / AIS)', fmt(paid.tds)],
    ['TCS', fmt(paid.tcs)],
    ['Self-Assessment Tax', fmt(paid.selfAssessment)],
    ['Total Taxes Paid', fmt(paid.totalPaid)],
    ['Balance Payable / Refund Due', tc.refundPayable.netPayable > 0 ? `Payable ${fmt(tc.refundPayable.netPayable)}` : `Refund ${fmt(tc.refundPayable.refund)}`]
  ];
  y = moneyTable(doc, y, ['Particulars', 'Amount (₹)'], paidRows, {
    boldIndex: [4, 5],
    highlightIndex: [5],
    colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38]
  });

  const refund = tc.refundPayable.refund;
  const balanceDue = tc.refundPayable.netPayable;
  if (refund > 0) {
    y = statusLine(doc, y + 2, true, `Taxes paid exceed liability by ${fmt(refund)} — refund due to be credited to bank account on record (${dash(r.businessInfo.bankName)}).`);
  } else if (balanceDue > 0) {
    y = statusLine(doc, y + 2, false, `Shortfall of ${fmt(balanceDue)} — verify with Form 26AS.`);
  } else {
    y = statusLine(doc, y + 2, true, 'Taxes fully settled — no balance due.');
  }
  return y;
}

/* ================= Section 5 ================= */

function renderSection5(doc: jsPDF, r: ReportData, y: number): number {
  const p = r.pnl;

  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Sales / Gross Turnover (E1)', fmt(p.sales)],
      ['Add: Closing Stock', fmt(p.closingStock)],
      ['Less: Opening Stock', p.openingStock > 0 ? fmt(p.openingStock) : '—'],
      ['Less: Purchases', fmt(p.purchases)],
      ['GROSS PROFIT', fmt(p.grossProfit)],
      ['Less: Operating Expenses', fmt(p.operatingExpenses)],
      ['Less: Depreciation', fmt(p.depreciation)],
      ['Add: Other Income', fmt(p.otherIncome)],
      ['NET PROFIT (as per 44AD declaration)', fmt(p.netProfit)]
    ],
    { boldIndex: [4, 8], highlightIndex: [8], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );
  y = footerNote(
    doc,
    y,
    'Note: Books of account are not required u/s 44AA for presumptive taxpayers. The P&L above is a working reconstruction from the return; net profit is the declared 44AD income.'
  );
  return y;
}

/* ================= Section 6 ================= */

function renderSection6(doc: jsPDF, r: ReportData, y: number): number {
  const liab = r.balanceSheet.liabilities;
  const assets = r.balanceSheet.assets;
  const cap = r.capitalAccount;

  const totalLiab = liab.total;
  const totalAssets = assets.total;
  const diff = r.balanceSheet.difference;
  const noFinancials = totalLiab === 0 && totalAssets === 0;

  y = moneyTable(
    doc,
    y,
    ['Liabilities', 'Amount (₹)', 'Assets', 'Amount (₹)'],
    [
      ['Capital (opening + profit − drawings)', fmt(liab.capital), 'Fixed Assets (net WDV)', fmt(assets.fixedAssets)],
      ['Secured Loans', fmt(liab.securedLoans), 'Investments', '—'],
      ['Unsecured Loans', fmt(liab.unsecuredLoans), 'Inventories / Closing Stock', fmt(assets.inventories)],
      ['Sundry Creditors', fmt(liab.creditors), 'Sundry Debtors', fmt(assets.debtors)],
      ['Other Current Liabilities', fmt(liab.otherLiabilities), 'Balance with Banks', fmt(assets.bank)],
      ['', '', 'Cash in Hand', fmt(assets.cash)],
      ['', '', 'Other Assets / Loans & Advances', fmt(assets.otherAssets)],
      ['TOTAL LIABILITIES', fmt(totalLiab), 'TOTAL ASSETS', fmt(totalAssets)]
    ],
    {
      boldIndex: [7],
      highlightIndex: [7],
      colWidths: [CONTENT_W * 0.36, CONTENT_W * 0.14, CONTENT_W * 0.36, CONTENT_W * 0.14]
    }
  );

  if (noFinancials) {
    y = footerNote(doc, y, 'No balance-sheet figures were reported in the JSON (all financial particulars are zero). The sheet above is shown for completeness; ask the client for their closing balance sheet to verify the capital account.');
  } else {
    y = statusLine(doc, y, diff <= Math.max(1, totalAssets * 0.005),
      diff > 0
        ? `Difference of ${fmt(diff)} between liabilities and assets — check capital account.`
        : 'Balanced — Total Liabilities = Total Assets');
  }

  y = miniHead(doc, y + 4, 'Capital Account Continuity');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      [`Opening Capital (1st April ${r.header.financialYear.slice(0, 4)})`, cap.openingCapital > 0 ? fmt(cap.openingCapital) : '—'],
      [`Add: Net Profit for FY ${r.header.financialYear}`, fmt(cap.netProfit)],
      ['Less: Drawings / Withdrawals', fmt(cap.drawings)],
      [`Closing Capital (31st March ${bsCloseYear(r.header.financialYear)})`, fmt(cap.closingCapital)]
    ],
    { boldIndex: [3], highlightIndex: [3], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );
  if (cap.closingCapital === 0 && cap.netProfit > 0) {
    y = footerNote(
      doc,
      y,
      'No closing capital reported in the JSON (PartnerMemberOwnCapital = 0). Opening capital of the previous year and drawings cannot be verified from this return alone — drawings shown as balancing figure.'
    );
  }
  return y;
}

/* ================= Section 7 ================= */

function renderSection7(doc: jsPDF, r: ReportData, y: number): number {
  const checks = r.hisabCheck;

  y = ensureSpace(doc, y, 120);
  const checkRows: Array<string[]> = checks.map((c) => [c.label, String(c.value), c.pass ? 'OK' : 'CHECK']);
  autoTable(doc, {
    startY: y,
    head: [['Check', 'Value', 'Status']],
    body: checkRows,
    ...tableBase,
    columnStyles: { 0: { cellWidth: CONTENT_W * 0.5 }, 1: { cellWidth: CONTENT_W * 0.34 }, 2: { cellWidth: CONTENT_W * 0.16 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const pass = checks[data.row.index].pass;
        data.cell.styles.textColor = (pass ? GREEN : RED) as unknown as string;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.halign = 'right';
      }
    }
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;

  const allPass = checks.every((c) => c.pass);
  y = statusLine(doc, y, allPass, allPass ? 'Calculation matches official record — reconciled.' : 'Review the difference between ITR record and manual calculation.');
  return y;
}

/* ================= Declaration ================= */

function renderDeclaration(doc: jsPDF, r: ReportData, y: number): number {
  const d = r.declaration;
  const filingDate = r.personalInfo.filingDate;

  const decl: Array<[string, string | number]> = [
    ['Declaration', 'I / We solemnly declare that the information given in this return of income is correct, complete and truly stated.'],
    ['Name', d.name.toUpperCase()],
    ['PAN', d.pan],
    ['Aadhaar', dash(d.aadhaar)],
    ['Assessment Year', d.assessmentYear],
    ['ITR Type', d.itrType],
    ['Financial Year', d.financialYear]
  ];
  y = kvTable(doc, y, decl);

  y = ensureSpace(doc, y, 160);

  doc.setDrawColor(215, 210, 200);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 30, PAGE_W - MARGIN, y + 30);

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(d.name.toUpperCase(), PAGE_W - MARGIN, y + 64, { align: 'right' });
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Signature of Assessee', PAGE_W - MARGIN, y + 78, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(90, 88, 92);
  doc.text('Place:', MARGIN, y + 64);
  doc.text(`Date: ${dash(filingDate || new Date().toISOString().slice(0, 10))}`, MARGIN, y + 78);
  return y + 100;
}

/* ================= Footer ================= */

function renderFooter(doc: jsPDF) {
  type GStateCtor = new (opts: { opacity: number }) => unknown;
  const gs = doc as unknown as { GState: GStateCtor };
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    doc.setGState(new gs.GState({ opacity: 0.09 }));
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(42);
    doc.setTextColor(150, 148, 150);
    doc.text('CA Anshul Karwa', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 30 });
    doc.setGState(new gs.GState({ opacity: 1 }));

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Prepared automatically by HISAB by CA Anshul Karwa — working file for the return computation', MARGIN, PAGE_H - 14);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 14, { align: 'right' });
  }
}

/* ================= Compare PDF ================= */

export async function generateComparePdf(result: CompareResult, options: PdfOptions = {}): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  await ensureRupeeFont(doc);
  const margin = MARGIN;
  const width = PAGE_W;
  const n = result.curr;
  const prevLabel = result.prev?.taxpayer.assessmentYear ?? null;

  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, width, 74, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 0, 5, 74, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(17);
  doc.text('HISAB — Year-on-Year Comparison', margin, 34);

  doc.setTextColor(200, 190, 175);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.text(`PREPARED FOR ${n.taxpayer.name} · PAN ${n.taxpayer.pan}`, margin, 54);

  let cursorY = 106;

  const head = ['Particulars', prevLabel ? `Prev · AY ${prevLabel}` : 'Previous', `Curr · AY ${n.taxpayer.assessmentYear}`, 'Growth'];

  const body = result.rows.map((row) => {
    const fmtCell = (v: number | string | null, kind: string) => {
      if (v === null) return '—';
      return kind === 'money' ? fmt(v as number) : kind === 'percent' ? `${(v as number).toFixed(2)}%` : String(v);
    };
    return [
      row.label,
      fmtCell(row.prev, row.kind),
      fmtCell(row.curr, row.kind),
      row.growth == null ? '—' : `${row.growth >= 0 ? '+' : ''}${row.growth.toFixed(1)}%`
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [head],
    body,
    ...tableBase,
    styles: { ...tableBase.styles, fontSize: 10, cellPadding: 8 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right';
    }
  });

  cursorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;

  if (result.capital) {
    const cap = result.capital;
    autoTable(doc, {
      startY: cursorY + 20,
      head: [['Capital Account Continuity', 'Amount']],
      body: [
        ['Opening Capital', fmt(cap.openingCapital)],
        ['Add: Net Profit', fmt(cap.netProfit)],
        ['Add: Capital Introduced', fmt(cap.capitalIntroduced)],
        ['Less: Drawings', fmt(cap.drawings)],
        ['Closing Capital', fmt(cap.closingCapital)]
      ],
      ...tableBase,
      styles: { ...tableBase.styles, fontSize: 10, cellPadding: 8 }
    });
    cursorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
  }

  if (result.alerts.length > 0) {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text('Reconciliation Alerts', margin, cursorY + 24);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    let y = cursorY + 44;
    for (const alert of result.alerts) {
      const lines = doc.splitTextToSize(`• ${alert}`, width - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 13 + 6;
    }
  }

  renderFooter(doc);

  const fileName = options.fileName ?? `HISAB_Compare_${n.taxpayer.pan}_${n.taxpayer.assessmentYear.replace('-', '_')}.pdf`;
  doc.save(fileName);
}
