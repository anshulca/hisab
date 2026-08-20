import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NormalizedITR } from '../types';
import { ensureRupeeFont } from '../pdf/fonts';
import {
  CONTENT_W, DARK, GOLD, GREEN, MARGIN, PAGE_W, RED,
  dash, ensureSpace, flowHead, fmt, footerNote, kvTable, miniHead, moneyTable,
  renderFooter, sanitizeFilename, statusLine, tableBase
} from '../pdf/pdfGenerator';
import { sealAndSavePdf } from '../pdf/seal';
import { buildItr2Report, maskAadhaar, maskBankAccount, maskEmail, maskMobile, maskPan, type I2ReportData } from './report';

function renderI2Header(doc: jsPDF, r: I2ReportData): number {
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
  doc.text(`${h.name.toUpperCase()}  ·  PAN ${maskPan(h.pan)}  ·  AY ${h.assessmentYear}  ·  FY ${h.financialYear}  ·  ${h.itrType.toUpperCase()}`, MARGIN, 54);

  const facts: Array<[string, string | number]> = [
    ['Name', h.name.toUpperCase()],
    ['Father’s Name', dash(p.fatherName)],
    ['PAN', maskPan(h.pan)],
    ['Date of Birth', dash(p.dob)],
    ['Aadhaar', dash(maskAadhaar(p.aadhaar))],
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

export async function buildItr2Pdf(normalized: NormalizedITR, initDoc?: jsPDF): Promise<jsPDF> {
  const report = buildItr2Report(normalized);
  const doc = initDoc ?? new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  await ensureRupeeFont(doc);

  let y = renderI2Header(doc, report);

  /* ------------------ Section 1: Personal Info ------------------ */
  y = flowHead(doc, y, 'Section 1', 'Personal Information', 'As per ITR-2 JSON — PartA_GEN1 + Verification');
  y = kvTable(
    doc,
    y,
    [
      ['Full Name', report.personalInfo.fullName.toUpperCase()],
      ['Father’s Name', dash(report.personalInfo.fatherName)],
      ['PAN', maskPan(report.personalInfo.pan)],
      ['Date of Birth', dash(report.personalInfo.dob)],
      ['Aadhaar Number', dash(maskAadhaar(report.personalInfo.aadhaar))],
      ['Mobile', dash(maskMobile(report.personalInfo.mobile))],
      ['Email', dash(maskEmail(report.personalInfo.email))],
      ['Residential Status', report.personalInfo.residentialStatus.toUpperCase()],
      ['Address', dash(report.personalInfo.address)],
      ['ITR Form', report.personalInfo.itrForm],
      ['Tax Regime', report.personalInfo.taxRegime],
      ['Filing Section', dash(report.personalInfo.filingSection)],
      ['Assessment Year', report.personalInfo.assessmentYear],
      ['Financial Year', report.personalInfo.financialYear],
      ['Acknowledgement No.', dash(report.personalInfo.ackNumber)],
      ['Date of Filing', dash(report.personalInfo.filingDate)]
    ],
    { twoCol: true }
  );

  /* ------------------ Section 2: Salary ------------------ */
  if (report.salary.incomeFromSalary !== 0 || report.salary.gross !== 0) {
    y = flowHead(doc, y, 'Section 2', 'Income from Salary', 'As per ITR-2 Schedule S — gross salary less exemptions and u/s 16 deductions');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ['Employer(s)', report.salary.employersText],
        ['Gross Salary', fmt(report.salary.gross)],
        ['Value of perquisites', report.salary.perquisites !== 0 ? fmt(report.salary.perquisites) : '—'],
        ['Profits in lieu of salary', report.salary.profitsInSalary !== 0 ? fmt(report.salary.profitsInSalary) : '—'],
        ['Less: Exempt allowances (u/s 10)', fmt(report.salary.exemptAllowances)],
        ['Net Salary (after exemptions)', fmt(report.salary.netSalary)],
        ['Less: Standard Deduction (u/s 16(ia))', fmt(report.salary.standardDeduction)],
        ['Less: Entertainment allowance (u/s 16(ii))', report.salary.entertainment !== 0 ? fmt(report.salary.entertainment) : '—'],
        ['Less: Professional Tax (u/s 16(iii))', report.salary.professionalTax !== 0 ? fmt(report.salary.professionalTax) : '—'],
        ['INCOME FROM SALARY', fmt(report.salary.incomeFromSalary)]
      ],
      { boldIndex: [9], highlightIndex: [9], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 3: House Property ------------------ */
  if (report.houseProperties.length > 0) {
    y = flowHead(doc, y, 'Section 3', 'Income from House Property', `${report.houseProperties.length} property(ies) as per ITR-2 Schedule HP`);
    for (let i = 0; i < report.houseProperties.length; i++) {
      const p = report.houseProperties[i];
      y = miniHead(doc, y, `Property ${i + 1} — ${p.address || 'N/A'}${p.letOut ? ` · ${p.letOut}` : ''}`);
      y = moneyTable(
        doc,
        y,
        ['Particulars', 'Amount (₹)'],
        [
          ['Annual Letable Value', fmt(p.annualValue)],
          ['Less: Municipal taxes', p.municipalTaxes !== 0 ? fmt(p.municipalTaxes) : '—'],
          ['Less: Rent not realized', p.rentNotRealized !== 0 ? fmt(p.rentNotRealized) : '—'],
          ['Net Annual Value', fmt(p.balanceALV)],
          ['Less: Deduction u/s 24(a) — 30% of NAV', fmt(p.std30)],
          ['Less: Interest on borrowed capital u/s 24(b)', p.interest !== 0 ? fmt(p.interest) : '—'],
          ['INCOME / LOSS FROM HOUSE PROPERTY', fmt(p.income)]
        ],
        { boldIndex: [6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
      );
    }
  }

  /* ------------------ Section 4: Capital Gains ------------------ */
  if (report.capitalGains.total !== 0 || report.capitalGains.items.length > 0) {
    y = flowHead(doc, y, 'Section 4', 'Capital Gains', 'As per ITR-2 Schedule CG For 23 / 112A / 115AD / VDA');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ...report.capitalGains.items.map((i) => [i.label, fmt(i.amount)] as [string, string]),
      ].concat(
        report.capitalGains.total !== 0
          ? ([
              ['TOTAL SHORT-TERM CAPITAL GAINS', fmt(report.capitalGains.totalStcg)],
              ['TOTAL LONG-TERM CAPITAL GAINS', fmt(report.capitalGains.totalLtcg)],
              ['TOTAL CAPITAL GAINS', fmt(report.capitalGains.total)]
            ] as Array<[string, string]>)
          : []
      ),
      { boldIndex: [report.capitalGains.items.length + (report.capitalGains.total !== 0 ? 2 : 0)], highlightIndex: [report.capitalGains.items.length + (report.capitalGains.total !== 0 ? 2 : 0)], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 5: Other Sources ------------------ */
  if (report.otherSourcesTotal !== 0 || report.otherSources.length > 0) {
    y = flowHead(doc, y, 'Section 5', 'Income from Other Sources', 'As per ITR-2 Schedule OS');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      report.otherSources.length
        ? [...report.otherSources.map((o) => [o.label, fmt(o.amount)] as [string, string]), ['TOTAL INCOME FROM OTHER SOURCES', fmt(report.otherSourcesTotal)]]
        : [['Total Income from Other Sources', fmt(report.otherSourcesTotal)]],
      { boldIndex: [report.otherSources.length], highlightIndex: [report.otherSources.length], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 6: Exempt Income ------------------ */
  if (report.exemptIncome.length > 0) {
    y = flowHead(doc, y, 'Section 6', 'Exempt Income', 'Income exempt from tax as reported in the record');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      report.exemptIncome.map((e) => [e.label, fmt(e.amount)] as [string, string]),
      { colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 7: Computation of Total Income & Tax ------------------ */
  y = flowHead(doc, y, 'Section 7', 'Computation of Total Income & Tax', `${report.header.regime} — as per ITR-2 Part B (PartB-TI + PartB_TTI)`, 860);
  y = miniHead(doc, y, 'Income Schedule');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Income from Salary', fmt(report.income.salary)],
      ['Income from House Property', report.income.houseProperty !== 0 ? fmt(report.income.houseProperty) : '—'],
      ['Capital Gains', report.income.capitalGains !== 0 ? fmt(report.income.capitalGains) : '—'],
      ['Income from Other Sources', report.income.otherSources !== 0 ? fmt(report.income.otherSources) : '—'],
      ['Gross Total Income (sum of heads)', fmt(report.income.grossTotal)],
      [`Less: Deductions u/s 80C–80U${report.header.regime.startsWith('New') ? ' — Nil under New Regime' : ''}`, report.header.regime.startsWith('New') && report.totalDeductions === 0 ? '—' : fmt(report.totalDeductions || 0)],
      ['Less: Special-rate income', report.income.specialRateIncome !== 0 ? fmt(report.income.specialRateIncome) : '—'],
      ['Aggregate Income (for normal rates)', fmt(report.income.aggregateIncome)],
      ['Total Income (as per ITR)', fmt(report.income.totalIncome)]
    ],
    { boldIndex: [4, 8], highlightIndex: [8], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  if (report.deductions.length > 0) {
    y = miniHead(doc, y, 'Chapter VI-A Deductions');
    y = moneyTable(
      doc,
      y,
      ['Section', 'Amount (₹)'],
      report.deductions.map((d) => [`Deduction u/s ${d.code}${d.label ? ` — ${d.label}` : ''}`, fmt(d.amount)])
    );
  }
  if (report.section80d) {
    y = miniHead(doc, y, 'Schedule 80-D — Medical Insurance');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ['Premium — self / family', fmt(report.section80d.self)],
        ['Premium — parents', fmt(report.section80d.parents)],
        ['Deduction u/s 80D (as applicable)', fmt(report.section80d.eligibleAmount)]
      ],
      { boldIndex: [2], highlightIndex: [2], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  if (report.specialIncomes.length > 0) {
    y = miniHead(doc, y, 'Special-Rate Incomes (Schedule SI)');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Rate', 'Amount (₹)'],
      report.specialIncomes.map((s) => [`${s.label}${s.rate ? ` (${s.rate}%)` : ''}`, '', fmt(s.amount)]),
      { colWidths: [CONTENT_W * 0.5, CONTENT_W * 0.16, CONTENT_W * 0.34] }
    );
  }

  y = miniHead(doc, y, 'Tax on Total Income');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Tax on income (normal rates)', fmt(report.taxComputed.json.taxNormal)],
      ['Tax on special-rate incomes', report.taxComputed.json.taxSpecialRates !== 0 ? fmt(report.taxComputed.json.taxSpecialRates) : '—'],
      ['Less: Rebate u/s 87A', report.taxComputed.json.rebate87A !== 0 ? fmt(report.taxComputed.json.rebate87A) : '—'],
      ['Surcharge', report.taxComputed.json.surcharge !== 0 ? fmt(report.taxComputed.json.surcharge) : '—'],
      ['Health & Education Cess (4%)', fmt(report.taxComputed.json.cess)],
      ['Gross Tax Liability', fmt(report.taxComputed.json.grossLiability)],
      ['Less: Relief u/s 89/90/91', report.taxComputed.json.taxRelief !== 0 ? fmt(report.taxComputed.json.taxRelief) : '—'],
      ['Net Tax Liability', fmt(report.taxComputed.json.netLiability)],
      ['Add: Interest u/s 234A / 234B / 234C', report.taxComputed.json.totalInterest !== 0 ? fmt(report.taxComputed.json.totalInterest) : '—'],
      ['Add: Late fee u/s 234F', report.taxComputed.json.lateFee234F !== 0 ? fmt(report.taxComputed.json.lateFee234F) : '—'],
      ['Aggregate Tax & Interest', fmt(report.taxComputed.json.aggregateLiability)]
    ],
    { boldIndex: [5, 10], highlightIndex: [10], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  if (report.amt.adjustedTotalIncome > 0 || report.amt.amtTax > 0) {
    y = miniHead(doc, y, 'Alternate Minimum Tax (AMT u/s 115JC)');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ['Adjusted total income u/s 115JC', fmt(report.amt.adjustedTotalIncome)],
        ['Tax on adjusted income (18.5%)', fmt(report.amt.amtTax)],
        ['AMT credit available', fmt(report.amt.amtCreditAvailable)]
      ],
      { colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 8: Taxes Paid & Refund / Payable ------------------ */
  y = flowHead(doc, y, 'Section 8', 'Taxes Paid & Refund / Payable', 'As per ITR-2 Schedule IT + Part B — compared with the computation');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Advance Tax', report.taxesPaid.advanceTax !== 0 ? fmt(report.taxesPaid.advanceTax) : '—'],
      ['TDS (Form 26AS / AIS)', fmt(report.taxesPaid.tds)],
      ['TCS', report.taxesPaid.tcs !== 0 ? fmt(report.taxesPaid.tcs) : '—'],
      ['Self-Assessment Tax', report.taxesPaid.selfAssessment !== 0 ? fmt(report.taxesPaid.selfAssessment) : '—'],
      ['Total Taxes Paid', fmt(report.taxesPaid.total)],
      ['Balance Payable (as per ITR)', report.taxesPaid.balancePayable !== 0 ? fmt(report.taxesPaid.balancePayable) : '—'],
      ['Refund Due (as per ITR)', report.refundReported !== 0 ? fmt(report.refundReported) : '—']
    ],
    { boldIndex: [4, 6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );
  if (report.bank) {
    y = footerNote(doc, y, `Refund bank account: ${report.bank.name} · A/c ${maskBankAccount(report.bank.accountNo)}${report.bank.ifsc ? ' · IFSC ' + report.bank.ifsc : ''}`);
  }
  if (report.taxesPaid.challansCount > 0) {
    y = footerNote(doc, y, `Challenge payments reported: ${report.taxesPaid.challansCount} challan(s) in Schedule IT — verify BSR codes against the tax payment statement.`);
  }

  /* ------------------ Section 9: HISAB Check ------------------ */
  y = flowHead(doc, y, 'Section 9', 'Hisab Check — Return vs Calculation', 'Cross-checks between the ITR record and this working file');
  y = ensureSpace(doc, y, 120);
  const checkRows: Array<string[]> = report.hisabCheck.map((c) => [c.label, String(c.value), c.pass ? 'OK' : 'CHECK']);
  autoTable(doc, {
    startY: y,
    head: [['Check', 'Value', 'Status']],
    body: checkRows,
    ...tableBase,
    columnStyles: { 0: { cellWidth: CONTENT_W * 0.5 }, 1: { cellWidth: CONTENT_W * 0.34 }, 2: { cellWidth: CONTENT_W * 0.16 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const pass = report.hisabCheck[data.row.index].pass;
        data.cell.styles.textColor = (pass ? GREEN : RED) as unknown as string;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.halign = 'right';
      }
    }
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 14;

  y = statusLine(doc, y, report.checksAllPass, report.checksAllPass ? 'Calculation matches official record — reconciled.' : 'Review the difference between ITR record and manual calculation.');

  /* ------------------ Declaration ------------------ */
  y = flowHead(doc, y, 'Declaration', 'Verification & Declaration', 'As per ITR-2 Verification block');
  y = kvTable(
    doc,
    y,
    [
      ['Verified by', report.verification.name.toUpperCase()],
      ['Father’s / Spouse’s Name', dash(report.verification.fatherName)],
      ['PAN', maskPan(report.verification.pan)],
      ['Capacity', dash(report.verification.capacity || 'Assessee')],
      ['Place', dash(report.verification.place)],
      ['Date', dash(report.verification.date)]
    ],
    { twoCol: true }
  );

  renderFooter(doc);
  return doc;
}

export async function generateItr2Pdf(normalized: NormalizedITR, fileName?: string): Promise<void> {
  const doc = await buildItr2Pdf(normalized);
  await sealAndSavePdf(
    doc,
    { itrType: normalized.itrForm ?? 'ITR-2', assessmentYear: normalized.taxpayer.assessmentYear },
    fileName ?? `${sanitizeFilename(normalized.taxpayer.name)} - Hisab by CA Anshul Karwa.pdf`
  );
}