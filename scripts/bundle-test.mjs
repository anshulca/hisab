import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItr4Object } from '../src/parser/itr4Parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'test-data');

const samples = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

for (const sample of samples) {
  const raw = fs.readFileSync(path.join(dataDir, sample), 'utf-8');
  const data = JSON.parse(raw);
  const { normalized, issues } = parseItr4Object(data);

  const rec = normalized.reportSections.find((s) => s.id === 'reconciliation');

  console.log(`\n=== ${sample} ===`);
  console.log(`Name: ${normalized.taxpayer.name} | PAN: ${normalized.taxpayer.pan} | Regime: ${normalized.taxpayer.regime} | Type: ${normalized.taxpayer.type}`);
  console.log(`Gross Receipts: ${normalized.incomeBreakdown.grossReceipts}`);
  console.log(`Business Income: ${normalized.incomeBreakdown.businessIncome}`);
  console.log(`Other Sources: ${normalized.incomeBreakdown.otherSources}`);
  console.log(`Total Income: ${normalized.incomeBreakdown.total}`);
  console.log(`Taxable: ${normalized.taxComputation.taxableIncome} | Tax: ${normalized.taxComputation.totalTax} | Net Payable: ${normalized.taxComputation.netTaxPayable}`);
  console.log(`TDS: ${normalized.taxComputation.tds} | Advance: ${normalized.taxComputation.advanceTax}`);
  console.log(`Sections: ${normalized.reportSections.map((s) => s.id).join(', ')}`);
  if (rec) {
    const sum = rec.details.find((d) => d.label === 'Profit Margin');
    const tdsRatio = rec.details.find((d) => d.label === 'TDS / Turnover');
    const refund = rec.details.find((d) => d.label === 'Expected Refund');
    const dispute = rec.details.find((d) => d.label === 'Dispute');
    console.log(`  [RECON] Profit Margin: ${sum?.value} | TDS/Turnover: ${tdsRatio?.value} | Expected Refund: ${refund?.value}`);
    console.log(`  [RECON] ${dispute?.value}`);
  }
  console.log(`Issues: ${issues.length}`);
}
