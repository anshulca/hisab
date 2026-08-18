import template from '../templates/reportTemplate.html?raw';
import { formatCurrency, formatCurrencyPlain } from '../utils/currency';
import { ReportGenerator, type ReportData } from './reportGenerator';
import type { NormalizedITR } from '../types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function amt(v: number): string {
  return `<td class="amount-cell">${formatCurrency(v)}</td>`;
}

function rowAmount(label: string, value: number, cls: string = ''): string {
  return `<tr class="${cls}"><td class="label-cell">${esc(label)}</td>${amt(value)}</tr>`;
}

function kvRows(rows: Array<[string, string]>): string {
  return `<table><colgroup><col style="width:42%"><col style="width:58%"></colgroup>${rows
    .map(([k, v]) => `<tr><td class="label-cell">${esc(k)}</td><td class="value-cell">${esc(v)}</td></tr>`)
    .join('')}</table>`;
}

function moneyRows(rows: string): string {
  return `<table><colgroup><col style="width:72%"><col style="width:28%"></colgroup>${rows}</table>`;
}

function section(title: string, sub: string, body: string, wide: boolean = false): string {
  return `<div class="section"><div class="section-header">${esc(title)}<span class="sub">${esc(sub)}</span></div><div class="section-body"${wide ? ' style="overflow-x:auto;"' : ''}>${body}</div></div>`;
}

function statusRow(pass: boolean): string {
  return pass ? '<span class="status-ok">OK</span>' : '<span class="status-error">CHECK</span>';
}

export function renderReportHtmlFromData(r: ReportData): string {
  const h = r.header;
  const p = r.personalInfo;
  const b = r.businessInfo;
  const bi = r.businessIncome;
  const tc = r.taxComputation;
  const pnl = r.pnl;
  const bs = r.balanceSheet;
  const cap = r.capitalAccount;

  // ---- Summary grid ----
  const netPayable = tc.taxDetails.netPayable;
  const summary = `<div class="summary-grid">
    <div class="summary-card"><div class="label">Total Income</div><div class="value">${formatCurrency(tc.incomeSchedule.grossTotal)}</div></div>
    <div class="summary-card"><div class="label">Tax Liability</div><div class="value">${netPayable > 0 ? formatCurrency(netPayable) : '—'}</div></div>
    <div class="summary-card"><div class="label">TDS Paid</div><div class="value green">${formatCurrency(tc.taxPaid.tds)}</div></div>
    <div class="summary-card"><div class="label">${tc.refundPayable.refund > 0 ? 'Refund Due' : 'Net Payable'}</div><div class="value ${tc.refundPayable.refund > 0 ? 'green' : netPayable > 0 ? 'red' : ''}">${tc.refundPayable.refund > 0 ? formatCurrency(tc.refundPayable.refund) : netPayable > 0 ? formatCurrency(netPayable) : 'Nil'}</div></div>
  </div>`;

  const identity = `<div class="brand-header-sub" style="text-align:center; font-size:12px; color:#333; margin-bottom:6px;">Working file — ${esc(h.name)} · PAN ${esc(h.pan)} · AY ${esc(h.assessmentYear)} · FY ${esc(h.financialYear)} · ${esc(h.itrType)}</div>`;

  // ---- Section 1: Personal Info ----
  const section1 = section('1 · Personal Information', 'As per ITR-4 JSON — PersonalInfo + Verification', kvRows([
    ['Full Name', p.fullName],
    ['Father’s Name', p.fatherName],
    ['PAN', p.pan],
    ['Date of Birth', p.dob],
    ['Aadhaar Number', p.aadhaar],
    ['Mobile', p.mobile],
    ['Email', p.email],
    ['Residential Status', p.residentialStatus],
    ['Address', p.address],
    ['ITR Form', p.itrForm],
    ['Tax Regime', p.taxRegime],
    ['Filing Section', p.filingSection],
    ['Assessment Year', p.assessmentYear],
    ['Financial Year', p.financialYear],
    ['Acknowledgement No.', p.ackNumber],
    ['Date of Filing', p.filingDate]
  ]));

  // ---- Section 2: Business Info ----
  const section2 = section('2 · Business Information', 'As per ITR-4 Schedule BP — Nature of Business (44AD)', kvRows([
    ['Name of Business', b.name],
    ['Business Code', b.code],
    ['Nature of Business', b.nature],
    ['Business Profile', b.profile],
    ['Section Applied', b.sectionApplied],
    ['Books of Account', b.booksOfAccount],
    ['Tax Regime', b.taxRegime],
    ['Bank Name', b.bankName],
    ['Account No.', b.accountNo],
    ['IFSC Code', b.ifscCode],
    ['Account Type', b.accountType],
    ['Refund Due', b.refundDue]
  ]));

  // ---- Section 3: Business Income (44AD) ----
  const section3 = section(
    '3 · Business Income — Section 44AD (Presumptive)',
    'Schedule BP · PersumptiveInc44AD · 6% on banking / 8% on cash',
    moneyRows(`
    ${rowAmount('Turnover — Banking receipts (E1a)', bi.turnover.banking)}
    ${rowAmount('Turnover — Cash receipts (E1b)', bi.turnover.cash)}
    ${rowAmount('Total Gross Turnover (E1)', bi.turnover.total, 'total-row')}
    ${rowAmount('Minimum income — 6% of banking receipts', bi.minimum.sixPercent)}
    ${rowAmount('Minimum income — 8% of cash receipts', bi.minimum.eightPercent)}
    ${rowAmount('Total minimum income (floor)', bi.minimum.total, 'total-row')}
    ${rowAmount('Declared income on banking (E2a)', bi.declared.banking)}
    ${rowAmount('Declared income on cash (E2b)', bi.declared.cash)}
    ${rowAmount('TOTAL DECLARED INCOME (E2c = E8 = B1)', bi.declared.total, 'gold-row')}
  `) + `<div class="note">Net Profit % = ${bi.npPercentage.toFixed(2)}% of turnover · Declared income ${bi.declared.total >= bi.minimum.total ? 'meets' : 'is below'} the 44AD minimum of ${formatCurrency(bi.minimum.total)}.</div>`
  );

  // ---- Section 4: Tax Computation ----
  const sched = tc.incomeSchedule;
  const scheduleRows = `
    <tr class="sub-row"><td class="label-cell">Income from Other Sources (B4)</td><td class="amount-cell">${formatCurrency(sched.otherSources)}</td></tr>
    <tr class="sub-row"><td class="label-cell">— of which: Savings / Interest</td><td class="amount-cell">${formatCurrency(sched.savingsInterest)}</td></tr>
    <tr class="sub-row"><td class="label-cell">— of which: Other</td><td class="amount-cell">${formatCurrency(sched.otherIncome)}</td></tr>`;

  const section4 = section(
    '4 · Computation of Tax',
    `${h.regime} · Part B (Income) + Part C (Deductions) + Part D (Tax)`,
    `<div class="note">Income Schedule (Part B)</div>` +
      moneyRows(`
      ${rowAmount('Income from Salary (B2)', sched.salary)}
      ${rowAmount('Income from House Property (B3)', sched.houseProperty)}
      ${rowAmount(`${b.sectionApplied.startsWith('44AD') ? 'Business Income u/s 44AD (B1 = E8 = E2c)' : 'Business Income u/s 44ADA (B1 = E8 = E2c)'}`, sched.business, 'highlight-row')}
      ${scheduleRows}
      ${rowAmount('Gross Total Income (B5)', sched.grossTotal, 'total-row')}
      ${rowAmount(`Less: Deductions u/s 80C–80U (C19)${h.regime.startsWith('New') ? ' — Nil under New Regime' : ''}`, sched.deductions)}
      ${rowAmount('Total / Taxable Income (C20)', sched.totalIncome, 'gold-row')}
    `) +
      `<div class="note">Tax on Income (Part D)</div>` +
      moneyRows(`
      ${rowAmount('Tax on Total Income (normal rates)', tc.taxDetails.taxOnIncome)}
      ${rowAmount('Surcharge', tc.taxDetails.surcharge)}
      ${rowAmount('Health & Education Cess (4%)', tc.taxDetails.cess)}
      ${rowAmount('Gross Tax Liability', tc.taxDetails.grossLiability, 'total-row')}
      ${rowAmount('Less: Rebate u/s 87A (max ₹25,000)', tc.taxDetails.rebate)}
      ${rowAmount('Add: Interest u/s 234A / 234B / 234C', tc.taxDetails.interest)}
      ${rowAmount('Net Tax Payable', tc.taxDetails.netPayable, 'gold-row')}
    `) +
      `<div class="note">Taxes Paid (Part D)</div>` +
      moneyRows(`
      ${rowAmount('Advance Tax', tc.taxPaid.advanceTax)}
      ${rowAmount('TDS (Form 26AS / AIS)', tc.taxPaid.tds)}
      ${rowAmount('TCS', tc.taxPaid.tcs)}
      ${rowAmount('Self-Assessment Tax', tc.taxPaid.selfAssessment)}
      ${rowAmount('Total Taxes Paid', tc.taxPaid.totalPaid, 'total-row')}
      ${rowAmount(tc.refundPayable.refund > 0 ? 'Refund Due' : 'Balance Payable', tc.refundPayable.refund > 0 ? tc.refundPayable.refund : tc.refundPayable.netPayable, 'gold-row')}
    `)
  );

  // ---- Section 5: P&L ----
  const section5 = section('5 · Trading Account & Profit and Loss', 'Reconstructed from return data · 44AD presumptive income is the net profit', moneyRows(`
    ${rowAmount('Sales / Gross Turnover (E1)', pnl.sales)}
    ${rowAmount('Add: Closing Stock', pnl.closingStock)}
    ${rowAmount('Less: Opening Stock', pnl.openingStock)}
    ${rowAmount('Less: Purchases', pnl.purchases)}
    ${rowAmount('GROSS PROFIT', pnl.grossProfit, 'total-row')}
    ${rowAmount('Less: Operating Expenses', pnl.operatingExpenses)}
    ${rowAmount('Less: Depreciation', pnl.depreciation)}
    ${rowAmount('Add: Other Income', pnl.otherIncome)}
    ${rowAmount('NET PROFIT (as per 44AD declaration)', pnl.netProfit, 'gold-row')}
  `) + `<div class="note">Books of account are not required u/s 44AA for presumptive taxpayers. The P&amp;L above is a working reconstruction from the return; net profit is the declared 44AD income.</div>`
  );

  // ---- Section 6: Balance Sheet ----
  const liaLabels: Array<[string, number]> = [
    ['Capital (opening + profit − drawings)', bs.liabilities.capital],
    ['Secured Loans', bs.liabilities.securedLoans],
    ['Unsecured Loans', bs.liabilities.unsecuredLoans],
    ['Sundry Creditors', bs.liabilities.creditors],
    ['Other Current Liabilities', bs.liabilities.otherLiabilities]
  ];
  const asstLabels: Array<[string, number]> = [
    ['Fixed Assets (net WDV)', bs.assets.fixedAssets],
    ['Investments', bs.assets.investments],
    ['Inventories / Closing Stock', bs.assets.inventories],
    ['Sundry Debtors', bs.assets.debtors],
    ['Balance with Banks', bs.assets.bank],
    ['Cash in Hand', bs.assets.cash],
    ['Other Assets / Loans & Advances', bs.assets.otherAssets]
  ];
  const maxLen = Math.max(liaLabels.length, asstLabels.length);
  const bsRows: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const l = liaLabels[i];
    const a = asstLabels[i];
    const left = l ? `<td class="label-cell">${esc(l[0])}</td>${l[0] === 'Investments' ? '' : amt(l[1])}` : '<td></td><td></td>';
    const right = a ? `<td class="label-cell">${esc(a[0])}</td>${a[0] === 'Investments' ? '<td class="amount-cell">—</td>' : amt(a[1])}` : '<td></td><td></td>';
    bsRows.push(`<tr>${left}${right}</tr>`);
  }
  bsRows.push(`<tr class="total-row"><td class="label-cell">TOTAL LIABILITIES</td>${amt(bs.liabilities.total)}<td class="label-cell">TOTAL ASSETS</td>${amt(bs.assets.total)}</tr>`);

  const section6 = section('6 · Balance Sheet', `As at 31st March · ${h.name} · PAN ${h.pan} · Schedule BP — FinancialParticularsOfBusiness`, `<div class="table-wrap"><table><colgroup><col style="width:28%"><col style="width:22%"><col style="width:28%"><col style="width:22%"></colgroup>${bsRows.join('')}</table></div>
    <div class="note">${bs.liabilities.total === 0 && bs.assets.total === 0 ? 'No balance-sheet figures were reported in the JSON (all financial particulars are zero). Ask the client for their closing balance sheet to verify the capital account.' : bs.reconciled ? 'Balanced — Total Liabilities = Total Assets.' : `Difference of ${formatCurrency(bs.difference)} between liabilities and assets — check capital account.`}</div>
    <div class="note">Capital Account Continuity</div>` +
    moneyRows(`
      ${rowAmount(`Opening Capital (1st April ${h.financialYear.slice(0, 4)})`, cap.openingCapital)}
      ${rowAmount(`Add: Net Profit for FY ${h.financialYear}`, cap.netProfit)}
      ${rowAmount('Less: Drawings / Withdrawals', cap.drawings)}
      ${rowAmount('Closing Capital', cap.closingCapital, 'gold-row')}
    `)
  );

  // ---- Section 7: Hisab Check ----
  const checkRows = r.hisabCheck
    .map((c) => {
      const value = typeof c.value === 'number' ? formatCurrencyPlain(c.value) : String(c.value);
      return `<tr><td class="label-cell">${esc(c.label)}</td><td class="amount-cell">${esc(value)}</td><td class="status-cell">${statusRow(c.pass)}</td></tr>`;
    })
    .join('');
  const allPass = r.hisabCheck.every((c) => c.pass);
  const section7 = section('7 · Hisab Check — Return vs Calculation', 'Cross-checks between the ITR record and this working file', `<table><colgroup><col style="width:50%"><col style="width:32%"><col style="width:18%"></colgroup>${checkRows}</table>
    <div class="note">${allPass ? 'Calculation matches official record — reconciled.' : 'Review the difference between ITR record and manual calculation.'}</div>`);

  // ---- Declaration ----
  const dcl = r.declaration;
  const section8 = section('Verification & Declaration', 'As per ITR-4 Verification block', `<div class="declaration">
    I / We solemnly declare that the information given in this return of income is correct, complete and truly stated.<br/><br/>
    Name: <strong>${esc(dcl.name)}</strong> · PAN: <strong>${esc(dcl.pan)}</strong> · Aadhaar: <strong>${esc(dcl.aadhaar)}</strong><br/>
    Assessment Year: ${esc(dcl.assessmentYear)} · ITR Type: ${esc(dcl.itrType)} · Financial Year: ${esc(dcl.financialYear)}<br/>
    Date: ${p.filingDate !== '—' ? esc(p.filingDate) : ''}
    <div class="signature">Signature of Assessee</div>
  </div>`);

  const content = `${identity}${summary}${section1}${section2}${section3}${section4}${section5}${section6}${section7}${section8}`;
  return template.replace('<div id="report-content"></div>', `<div id="report-content">${content}</div>`);
}

export function renderReportHtml(normalized: NormalizedITR): string {
  const report = new ReportGenerator().generate(normalized);
  return renderReportHtmlFromData(report);
}