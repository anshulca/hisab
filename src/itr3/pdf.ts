import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NormalizedITR } from '../types';
import { ensureRupeeFont } from '../pdf/fonts';
import {
  CONTENT_W, DARK, GOLD, GREEN, MARGIN, PAGE_W, RED,
  dash, ensureSpace, flowHead, fmt, footerNote, kvTable, miniHead, moneyTable,
  renderFooter, sanitizeFilename, statusLine, tableBase
} from '../pdf/pdfGenerator';
import { buildItr3Report, type I3ReportData } from './report';

function renderI3Header(doc: jsPDF, r: I3ReportData): number {
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

export async function buildItr3Pdf(normalized: NormalizedITR, initDoc?: jsPDF): Promise<jsPDF> {
  const report = buildItr3Report(normalized);
  const doc = initDoc ?? new jsPDF({ unit: 'pt', format: 'a4' });
  await ensureRupeeFont(doc);

  let y = renderI3Header(doc, report);
  const closeYear = `31st March ${report.header.financialYear.slice(5, 7) ? `20${report.header.financialYear.slice(5, 7)}` : report.header.financialYear.slice(0, 4)}`;

  /* ------------------ Section 1: Personal Info ------------------ */
  y = flowHead(doc, y, 'Section 1', 'Personal Information', 'As per ITR-3 JSON — PartA_GEN1 + Verification');
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

  /* ------------------ Section 2: Business ------------------ */
  y = flowHead(doc, y, 'Section 2', 'Business / Profession', 'As per ITR-3 PartA_GEN2 + Schedule BP');
  for (const n of report.businessInfo.natures) {
    y = statusLine(doc, y, true, `${n.tradeName}${n.description ? ` — ${n.description}` : ''}${n.code ? ` (${n.code})` : ''}`);
  }
  y = statusLine(doc, y, true, `Method of accounting: ${report.businessInfo.methodOfAccounting}  ·  Audit u/s 44AB: ${report.businessInfo.audited}  ·  Turnover band: ${report.businessInfo.turnoverBand}`);
  if (report.businessInfo.natureLabel && report.businessInfo.natures.length === 0) {
    y = statusLine(doc, y, true, report.businessInfo.natureLabel);
  }
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Profit before tax (P&L)', fmt(report.businessInfo.profitBeforeTax)],
      ['Balance as per books (Schedule BP)', fmt(report.businessInfo.balancePL)],
      ['Depreciation allowed u/s 32', report.businessInfo.depreciation !== 0 ? fmt(report.businessInfo.depreciation) : '—'],
      ['Adjusted book profit', report.businessInfo.adjustedPL !== 0 ? fmt(report.businessInfo.adjustedPL) : '—'],
      ['INCOME CHARGEABLE UNDER BUSINESS / PROFESSION', fmt(report.businessInfo.incomeChargeable)]
    ],
    { boldIndex: [4], highlightIndex: [4], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  /* ------------------ Section 3: Salary ------------------ */
  if (report.salary.incomeFromSalary !== 0 || report.salary.gross !== 0) {
    y = flowHead(doc, y, 'Section 3', 'Income from Salary', 'As per ITR-3 Schedule S — gross salary less exemptions and u/s 16 deductions');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ['Employer', report.salary.employersText],
        ['Gross Salary', fmt(report.salary.gross)],
        ['Less: Exempt allowances (u/s 10)', fmt(report.salary.exemptAllowances)],
        ['Net Salary (after exemptions)', fmt(report.salary.netSalary)],
        ['Less: Standard Deduction (u/s 16(ia))', fmt(report.salary.standardDeduction)],
        ['Less: Professional Tax (u/s 16(iii))', report.salary.professionalTax !== 0 ? fmt(report.salary.professionalTax) : '—'],
        ['INCOME FROM SALARY', fmt(report.salary.incomeFromSalary)]
      ],
      { boldIndex: [6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
    if (report.salary.hra.present) {
      y = miniHead(doc, y, 'HRA Exemption u/s 10(13A)');
      y = moneyTable(
        doc,
        y,
        ['Particulars', 'Amount (₹)'],
        [
          ['HRA received', fmt(report.salary.hra.hraReceived)],
          ['Rent paid', fmt(report.salary.hra.rentPaid)],
          ['Exempt HRA (least of three)', fmt(report.salary.hra.eligibleExemption)]
        ],
        { colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
      );
    }
  }

  /* ------------------ Section 4: House Property ------------------ */
  if (report.houseProperties.length > 0) {
    y = flowHead(doc, y, 'Section 4', 'Income from House Property', `${report.houseProperties.length} property(ies) as per ITR-3 Schedule HP`);
    for (let i = 0; i < report.houseProperties.length; i++) {
      const p = report.houseProperties[i];
      y = miniHead(doc, y, `Property ${i + 1} — ${p.address || 'N/A'}${p.tenant ? ` · Tenant: ${p.tenant}` : ''}`);
      y = moneyTable(
        doc,
        y,
        ['Particulars', 'Amount (₹)'],
        [
          ['Annual Letable Value', fmt(p.annualValue)],
          ['Less: Municipal taxes', p.municipalTaxes !== 0 ? fmt(p.municipalTaxes) : '—'],
          ['Less: Rent not realized', p.rentNotRealized !== 0 ? fmt(p.rentNotRealized) : '—'],
          ['Net Annual Value', fmt(p.balanceALV)],
          ['Less: Deduction u/s 24(a) — 30% of NAV', fmt(Math.round(p.balanceALV * 0.3))],
          ['Less: Interest on borrowed capital u/s 24(b)', p.interest !== 0 ? fmt(p.interest) : '—'],
          ['INCOME / LOSS FROM HOUSE PROPERTY', fmt(p.income)]
        ],
        { boldIndex: [6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
      );
    }
  }

  /* ------------------ Section 5: Capital Gains ------------------ */
  if (report.capitalGains.total !== 0) {
    y = flowHead(doc, y, 'Section 5', 'Capital Gains', 'As per ITR-3 Schedule CG — short-term 111A / other, long-term 112A');
    y = moneyTable(
      doc,
      y,
      ['Particulars', 'Amount (₹)'],
      [
        ...report.capitalGains.stcg.map((s) => [s.label, fmt(s.amount)] as [string, string]),
        ...report.capitalGains.ltcg.map((s) => [s.label, fmt(s.amount)] as [string, string]),
        ['TOTAL SHORT-TERM CAPITAL GAINS', fmt(report.capitalGains.totalStcg)],
        ['TOTAL LONG-TERM CAPITAL GAINS', fmt(report.capitalGains.totalLtcg)],
        ['TOTAL CAPITAL GAINS', fmt(report.capitalGains.total)]
      ],
      { boldIndex: [report.capitalGains.stcg.length + report.capitalGains.ltcg.length + 2], highlightIndex: [report.capitalGains.stcg.length + report.capitalGains.ltcg.length + 2], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
    );
  }

  /* ------------------ Section 6: Other Sources ------------------ */
  if (report.otherSourcesTotal !== 0 || report.otherSources.length > 0) {
    y = flowHead(doc, y, 'Section 6', 'Income from Other Sources', 'As per ITR-3 Schedule OS');
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

  /* ------------------ Section 7: Computation of Total Income & Tax ------------------ */
  y = flowHead(doc, y, 'Section 7', 'Computation of Total Income & Tax', `${report.header.regime} — as per ITR-3 Part B (PartB-TI + PartB_TTI)`, 860);
  y = miniHead(doc, y, 'Income Schedule');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Income from Salary', fmt(report.income.salary)],
      ['Income from House Property', report.income.houseProperty !== 0 ? fmt(report.income.houseProperty) : '—'],
      ['Business / Profession', fmt(report.income.business)],
      ['Capital Gains', report.income.capitalGains !== 0 ? fmt(report.income.capitalGains) : '—'],
      ['Income from Other Sources', report.income.otherSources !== 0 ? fmt(report.income.otherSources) : '—'],
      ['Gross Total Income (sum of heads)', fmt(report.income.grossTotal)],
      [`Less: Deductions u/s 80C–80U${report.header.regime.startsWith('New') ? ' — Nil under New Regime' : ''}`, report.header.regime.startsWith('New') && report.totalDeductions === 0 ? '—' : fmt(report.totalDeductions || 0)],
      ['Total Income (as per ITR)', fmt(report.income.totalIncome)]
    ],
    { boldIndex: [5, 7], highlightIndex: [7], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );

  if (report.deductions.length > 0) {
    y = miniHead(doc, y, 'Chapter VI-A Deductions');
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
      ['Tax on special-rate incomes', report.taxComputed.taxSpecialRates !== 0 ? fmt(report.taxComputed.taxSpecialRates) : '—'],
      ['Surcharge', report.taxComputed.surcharge !== 0 ? fmt(report.taxComputed.surcharge) : '—'],
      ['Health & Education Cess (4%)', fmt(report.taxComputed.cess)],
      ['Gross Tax Liability', fmt(report.taxComputed.grossLiability)],
      ['Less: Relief u/s 89/90/91', report.taxComputed.taxRelief !== 0 ? fmt(report.taxComputed.taxRelief) : '—'],
      ['Net Tax Liability', fmt(report.taxComputed.netLiability)],
      ['Add: Interest u/s 234A / 234B / 234C', report.taxComputed.totalInterest !== 0 ? fmt(report.taxComputed.totalInterest) : '—'],
      ['Aggregate Tax & Interest', fmt(report.taxComputed.aggregateLiability)]
    ],
    { boldIndex: [4, 8], highlightIndex: [8], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
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
  y = flowHead(doc, y, 'Section 8', 'Taxes Paid & Refund / Payable', 'As per ITR-3 Schedule IT + Part B — compared with the computation');
  y = moneyTable(
    doc,
    y,
    ['Particulars', 'Amount (₹)'],
    [
      ['Advance Tax', report.taxesPaid.advanceTax !== 0 ? fmt(report.taxesPaid.advanceTax) : '—'],
      ['TDS (Form 26AS / AIS)', fmt(report.taxesPaid.tds)],
      ['TCS', report.taxesPaid.tcs !== 0 ? fmt(report.taxesPaid.tcs) : '—'],
      ['Self-Assessment Tax', fmt(report.taxesPaid.selfAssessment)],
      ['Total Taxes Paid', fmt(report.taxesPaid.total)],
      ['Balance Payable (as per ITR)', report.taxesPaid.balancePayable !== 0 ? fmt(report.taxesPaid.balancePayable) : '—'],
      ['Refund Due (as per ITR)', report.refundReported !== 0 ? fmt(report.refundReported) : '—']
    ],
    { boldIndex: [4, 6], highlightIndex: [6], colWidths: [CONTENT_W * 0.62, CONTENT_W * 0.38] }
  );
  if (report.taxesPaid.challansCount > 0) {
    y = footerNote(doc, y, `Challenge payments reported: ${report.taxesPaid.challansCount} challan(s) in Schedule IT — verify BSR codes against the tax payment statement.`);
  }

  /* ------------------ Section 9: Balance Sheet ------------------ */
  if (report.balanceSheet.present) {
    y = flowHead(doc, y, 'Section 9', `Balance Sheet as at ${closeYear}`, `${report.header.name} · Schedule BP — Financial Particulars (PartA_BS)`);
    y = moneyTable(
      doc,
      y,
      ['Liabilities', 'Amount (₹)', 'Assets', 'Amount (₹)'],
      [
        ['Capital', fmt(report.balanceSheet.capital), 'Fixed Assets', fmt(report.balanceSheet.fixedAssets)],
        ['Secured Loans', fmt(report.balanceSheet.securedLoans), 'Investments', fmt(report.balanceSheet.investments)],
        ['Unsecured Loans', fmt(report.balanceSheet.unsecuredLoans), 'Inventories', fmt(report.balanceSheet.inventories)],
        ['Other Liabilities', '—', 'Debtors / Receivables', fmt(report.balanceSheet.debtors)],
        ['TOTAL LIABILITIES', fmt(report.balanceSheet.liabilitiesTotal), 'Bank Balances', fmt(report.balanceSheet.bank)],
        ['', '', 'Cash in Hand', fmt(report.balanceSheet.cash)],
        ['', '', 'Other Assets', fmt(report.balanceSheet.otherAssets)],
        ['', '', 'TOTAL ASSETS', fmt(report.balanceSheet.assetsTotal)]
      ],
      { boldIndex: [4, 7], highlightIndex: [4], colWidths: [CONTENT_W * 0.38, CONTENT_W * 0.12, CONTENT_W * 0.38, CONTENT_W * 0.12] }
    );
    y = statusLine(
      doc,
      y,
      report.balanceSheet.difference <= Math.max(1, report.balanceSheet.assetsTotal * 0.005),
      report.balanceSheet.difference > 0
        ? `Difference of ${fmt(report.balanceSheet.difference)} between liabilities and assets — check capital account.`
        : 'Balanced — Total Liabilities = Total Assets'
    );
  }

  /* ------------------ Section 10: HISAB Check ------------------ */
  y = flowHead(doc, y, 'Section 10', 'Hisab Check — Return vs Calculation', 'Cross-checks between the ITR record and this working file');
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

  /* ------------------ Declaration ------------------ */
  y = flowHead(doc, y, 'Declaration', 'Verification & Declaration', 'As per ITR-3 Verification block');
  y = kvTable(
    doc,
    y,
    [
      ['Verified by', report.verification.name.toUpperCase()],
      ['Father’s / Spouse’s Name', dash(report.verification.fatherName)],
      ['PAN', report.verification.pan],
      ['Capacity', dash(report.verification.capacity || 'Assessee')],
      ['Place', dash(report.verification.place)],
      ['Date', dash(report.verification.date)]
    ],
    { twoCol: true }
  );

  renderFooter(doc);
  return doc;
}

export async function generateItr3Pdf(normalized: NormalizedITR, fileName?: string): Promise<void> {
  const doc = await buildItr3Pdf(normalized);
  doc.save(fileName ?? `${sanitizeFilename(normalized.taxpayer.name)} - Hisab by CA Anshul Karwa.pdf`);
}