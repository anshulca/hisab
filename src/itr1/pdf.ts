import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NormalizedITR } from '../types';
import { ensureRupeeFont } from '../pdf/fonts';
import {
  CONTENT_W, DARK, GOLD, GREEN, MARGIN, PAGE_W, RED,
  dash, ensureSpace, flowHead, fmt, footerNote, kvTable, miniHead, moneyTable,
  renderFooter, sanitizeFilename, statusLine, tableBase
} from '../pdf/pdfGenerator';
import { buildItr1Report, type I1ReportData } from './report';

function renderI1Header(doc: jsPDF, r: I1ReportData): number {
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

export async function buildItr1Pdf(normalized: NormalizedITR, initDoc?: jsPDF): Promise<jsPDF> {
  const report = buildItr1Report(normalized);
  const doc = initDoc ?? new jsPDF({ unit: 'pt', format: 'a4' });
  await ensureRupeeFont(doc);

  let y = renderI1Header(doc, report);

  /* ------------------ Section 1: Personal Info ------------------ */
  y = flowHead(doc, y, 'Section 1', 'Personal Information', 'As per ITR-1 JSON — PersonalInfo + Verification');
  y = kvTable(
    doc,
    y,
    [
      ['Full Name', report.personalInfo.fullName.toUpperCase()],
      ['Father’s Name', dash(report.personalInfo.fatherName)],
      ['PAN', report.personalInfo.pan],
      ['Date of Birth', dash(report.personalInfo.dob)],
      ['Aadhaar Number', dash(report.personalInfo.aadhaar)],
      ['Mobile', dash(report.personalInfo.mobile)],
      ['Email', dash(report.personalInfo.email)],
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
  if (report.employerCategory && report.employerCategory !== '—') {
    y = statusLine(doc, y, true, `Employer Category: ${report.employerCategory}`);
  }

  /* ------------------ Section 2: Salary ------------------ */
  y = flowHead(doc, y, 'Section 2', 'Income from Salary', 'As per ITR-1 ITR1_IncomeDeductions — gross salary less exemptions and u/s 16 deductions');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Gross Salary', fmt(report.salary.gross)],
      ['   Salary component', fmt(report.salary.salaryComponent)],
      ['   Perquisites value', fmt(report.salary.perquisites)],
      ['   Profits in lieu of salary', fmt(report.salary.profitsInSalary)],
      ['Less: Exempt allowances (u/s 10)', fmt(report.salary.exemptAllowances)],
      ['Net Salary (after exemptions)', fmt(report.salary.netSalary)],
      ['Less: Standard Deduction (u/s 16(ia))', fmt(report.salary.standardDeduction)],
      ['Less: Entertainment Allowance (u/s 16(ii))', fmt(report.salary.entertainment)],
      ['Less: Professional Tax (u/s 16(iii))', fmt(report.salary.professionalTax)],
      ['INCOME FROM SALARY', fmt(report.salary.incomeFromSalary)]
    ],
    {
      boldIndex: [9],
      highlightIndex: [9],
      colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38]
    }
  );

  if (report.salary.incomeFromSalarySource === 'CALCULATED') {
    y = footerNote(
      doc,
      y,
      'Note: IncomeFromSal was not reported (or differed) in the JSON, so it has been reconstructed from the salary components above. Cross-check against Form 16.'
    );
  }

  /* ------------------ Section 3: House Property ------------------ */
  if (report.houseProperties.length > 0) {
    y = flowHead(doc, y, 'Section 3', 'Income from House Property', `${report.houseProperties.length} property(ies) as per ITR-1${report.houseProperties.length > 1 ? ' — each handled separately' : ''}`);
    for (let i = 0; i < report.houseProperties.length; i++) {
      const p = report.houseProperties[i];
      y = miniHead(doc, y, `Property ${i + 1} — ${p.type}${p.address ? ` · ${p.address}` : ''}`);
      const nav = p.annualValue - p.municipalTax;
      y = moneyTable(
        doc,
        y,
        ['Particulars', 'Amount (₹)'],
        [
          ['Gross rent received', fmt(p.grossRent)],
          ['Less: Municipal taxes', fmt(p.municipalTax)],
          ['Net Annual Value (computed)', fmt(nav)],
          ['Less: Deduction u/s 24(a) — 30% of NAV', fmt(Math.round(nav * 0.3))],
          ['Less: Interest on borrowed capital u/s 24(b)', fmt(p.interest)],
          ['Add: Arrears of rent (if any)', p.arrears > 0 ? fmt(p.arrears) : '—'],
          ['INCOME / LOSS FROM HOUSE PROPERTY', fmt(p.income)]
        ],
        { boldIndex: [6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
      );
    }
  }

  /* ------------------ Section 4: Other Sources ------------------ */
  y = flowHead(doc, y, 'Section 4', 'Income from Other Sources', 'As per ITR-1 OthersInc + DeductionUs57iia (80TTA/80TTB)');
  if (report.otherSources.length > 0) {
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      report.otherSources.map((o) => [`${o.description || o.nature || 'Other Income'}${o.nature && o.nature !== o.description ? ` (${o.nature})` : ''}`, fmt(o.amount)])
    );
  }
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Total Income from Other Sources', fmt(report.otherSourcesTotal)],
      ['Less: Deduction u/s 80TTA / 80TTB (savings interest)', report.savingsInterestDeduction > 0 ? fmt(report.savingsInterestDeduction) : '—'],
      ['INCOME CHARGEABLE FROM OTHER SOURCES', fmt(Math.max(0, report.otherSourcesTotal - report.savingsInterestDeduction))]
    ],
    { boldIndex: [2], highlightIndex: [2], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );
  if (report.exemptions.count > 0) {
    y = flowHead(doc, y, 'Section 4B', 'Section 10 Exempt Income', 'Exempt income reported u/s 10 — not chargeable to tax (included for rate purposes)');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ...report.exemptions.items.map((e) => [e.label, fmt(e.amount)]),
        ['TOTAL EXEMPT INCOME (u/s 10)', fmt(report.exemptions.total)]
      ],
      { boldIndex: [report.exemptions.items.length], highlightIndex: [report.exemptions.items.length], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  } else if (report.exemptAgriIncome > 0) {
    y = footerNote(doc, y, `Agricultural / exempt income reported u/s 10(1): ₹${fmt(report.exemptAgriIncome)} — exempt from tax but included for rate purposes if above the limit.`);
  }

  /* ------------------ Section 5: Capital Gains (only if applicable) ------------------ */
  if (report.ltc.present) {
    y = flowHead(doc, y, 'Section 5', 'Capital Gains — LTCG u/s 112A', 'As per ITR-1 LTCG112A — long-term capital gains on listed equity');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ['Full value of consideration', fmt(report.ltc.saleConsideration)],
        ['Less: Cost of acquisition', fmt(report.ltc.costOfAcquisition)],
        ['LONG-TERM CAPITAL GAIN u/s 112A', fmt(report.ltc.gain)],
        ['Less: Exemption of ₹1,25,000', '—'],
        ['Taxable LTCG 112A', fmt(Math.max(0, report.ltc.gain - 125000))]
      ],
      { boldIndex: [4], highlightIndex: [4], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 6: Computation of Total Income & Tax ------------------ */
  y = flowHead(
    doc,
    y,
    'Section 6',
    'Computation of Total Income & Tax',
    `${report.header.regime} — reported values from ITR compared with HISAB calculation`,
    800
  );
  y = miniHead(doc, y, 'Income Schedule');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Income from Salary', fmt(report.income.salary)],
      ['Income from House Property', fmt(report.income.houseProperty)],
      ['Income from Other Sources', fmt(report.income.otherSources)],
      ...(report.ltc.present ? [['Capital Gains (112A)', fmt(report.income.capitalGains)] as [string, string]] : []),
      ['Gross Total Income (sum of heads)', fmt(report.income.grossTotalCalculated)],
      ['   Gross Total Income as per ITR', report.income.grossTotalReported !== 0 ? fmt(report.income.grossTotalReported) : '—'],
      [`Less: Deductions (Chapter VI-A) — ${report.header.regime.startsWith('New') ? 'Nil under New Regime' : 'as per ITR'}`, report.header.regime.startsWith('New') ? '—' : fmt(report.totalDeductions)],
      ['Total / Taxable Income', report.income.totalIncomeReported !== 0 ? fmt(report.income.totalIncomeReported) : '—'],
      ['Taxable Income (HISAB calculation)', fmt(report.income.taxableCalculated)]
    ],
    { boldIndex: [3, 8], highlightIndex: [8], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  if (report.deductions.length > 0 && report.header.regime.startsWith('Old')) {
    y = miniHead(doc, y, 'Chapter VI-A Deductions (old regime)');
    y = moneyTable(
      doc,
      y,
      ['Section', 'Amount (₹)'],
      report.deductions.map((d) => [`Deduction u/s ${d.code}`, fmt(d.amount)])
    );
  }

  y = miniHead(doc, y, 'Tax on Total Income');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Tax on income (normal rates)', fmt(report.taxComputed.taxNormal)],
      ...(report.ltc.present ? [['Tax on LTCG 112A @12.5% (excl. ₹1,25,000)', fmt(report.taxComputed.ltcTax)] as [string, string]] : []),
      ['Less: Rebate u/s 87A', fmt(report.taxComputed.rebate)],
      ['Surcharge', report.taxComputed.surcharge > 0 ? fmt(report.taxComputed.surcharge) : '—'],
      ['Health & Education Cess (4%)', fmt(report.taxComputed.cess)],
      ['Total Tax (HISAB)', fmt(report.taxComputed.grossLiability)],
      ['Add: Interest u/s 234A / 234B / 234C', report.taxComputed.interest234 > 0 ? fmt(report.taxComputed.interest234) : '—'],
      ['Net Tax Payable (HISAB)', report.taxComputed.netPayable > 0 ? fmt(report.taxComputed.netPayable) : '—']
    ],
    { boldIndex: [5, 7], highlightIndex: [7], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  y = statusLine(
    doc,
    y,
    Math.abs(report.taxComputed.grossLiability - report.taxReported.grossLiability) <= Math.max(2, report.taxReported.grossLiability * 0.02) || report.taxReported.grossLiability === 0,
    `HISAB tax ${fmt(report.taxComputed.grossLiability)} vs ITR ${fmt(report.taxReported.grossLiability)} — ${Math.abs(report.taxComputed.grossLiability - report.taxReported.grossLiability) <= Math.max(2, report.taxReported.grossLiability * 0.02) ? 'reconciled' : 'review difference for 26AS and rebate applicability.'}`
  );

  /* ------------------ Section 7: Taxes Paid & Refund / Payable ------------------ */
  y = flowHead(doc, y, 'Section 7', 'Taxes Paid & Refund / Payable', 'As per ITR-1 TaxPaid + Refund — compared with HISAB computation');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Advance Tax', fmt(report.taxesPaid.advanceTax)],
      ['TDS (Form 26AS / AIS)', fmt(report.taxesPaid.tds)],
      ['TCS', fmt(report.taxesPaid.tcs)],
      ['Self-Assessment Tax', fmt(report.taxesPaid.selfAssessment)],
      ['Total Taxes Paid', fmt(report.taxesPaid.total)],
      ['Balance Payable (as per ITR)', report.taxesPaid.balancePayable > 0 ? fmt(report.taxesPaid.balancePayable) : '—'],
      ['Refund Due (as per ITR)', report.refundReported > 0 ? fmt(report.refundReported) : '—']
    ],
    { boldIndex: [4, 5, 6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  if (report.refundReported > 0) {
    y = statusLine(doc, y, true, `Refund of ${fmt(report.refundReported)} due as per ITR${report.bank ? ` — credit to ${report.bank.name} a/c ${report.bank.accountNo} (${report.bank.ifsc})` : ''}.`);
  } else if (report.taxesPaid.balancePayable > 0) {
    y = statusLine(doc, y, false, `Balance tax payable of ${fmt(report.taxesPaid.balancePayable)} as per ITR.`);
  } else {
    y = statusLine(doc, y, true, 'No refund / balance payable reported in the ITR.');
  }

  /* ------------------ Section 8: HISAB Check ------------------ */
  y = flowHead(doc, y, 'Section 8', 'Hisab Check — Return vs Calculation', 'Cross-checks between the ITR record and this working file');
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
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;

  y = statusLine(doc, y, report.checksAllPass, report.checksAllPass ? 'Calculation matches official record — reconciled.' : 'Review the difference between ITR record and manual calculation.');

  if (!report.checksAllPass) {
    y = footerNote(doc, y, 'HISAB Check compares the ITR-reported figures with this working computation. Any difference must be verified before finalising the return details.');
  }

  renderFooter(doc);
  return doc;
}

export async function generateItr1Pdf(normalized: NormalizedITR, fileName?: string): Promise<void> {
  const doc = await buildItr1Pdf(normalized);
  doc.save(fileName ?? `${sanitizeFilename(normalized.taxpayer.name)} - Hisab by CA Anshul Karwa.pdf`);
}