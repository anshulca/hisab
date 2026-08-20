/**
 * ITR-2 smoke test — parse the genuine fixtures and sanity-report key figures.
 * Bundles the parser with esbuild (Node cannot import extensionless .ts directly).
 * Usage: node scripts/itr2-smoke.mjs
 */
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tmpDir = resolve(root, '.tmp');
const out = resolve(tmpDir, 'itr2-parser-smoke.mjs');

await build({
  entryPoints: ['src/itr2/parser.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error'
});

const { parseItr2 } = await import(pathToFileURL(out).href + '?t=' + Date.now());

const fixtures = ['test-data/ITR2_JSon_R-088.json', 'test-data/231625900300724.json'];
let failed = 0;

function check(cond, msg) {
  if (!cond) { failed++; console.log('  FAIL:', msg); }
}

for (const f of fixtures) {
  const raw = readFileSync(resolve(root, f), 'utf8');
  const { normalized, issues } = parseItr2(raw);
  const d = normalized.itr2;
  const label = `${normalized.taxpayer.name} · PAN ${normalized.taxpayer.pan} · AY ${d.assessmentYear} · ${d.regime}`;
  console.log(`\n=== ${f.split(/[\\/]/).pop()} ===`);
  console.log(label);
  console.log('  income:', JSON.stringify(d.income));
  console.log('  taxComputed:', JSON.stringify(d.taxComputed));
  console.log('  taxesPaid.total:', d.taxesPaid.total, '| refund:', d.refund.refundDue, '| balancePayable:', d.taxesPaid.balancePayable);
  console.log('  reportSections:', normalized.reportSections.map((s) => s.id).join(', '));
  console.log('  issues:', issues.length ? issues.map((i) => i.message).join(' | ') : 'none');

  if (normalized.itrForm !== 'ITR2') { failed++; console.log('  FAIL: itrForm', normalized.itrForm); }
  if (normalized.reportSections.length < 4) { failed++; console.log('  FAIL: too few report sections'); }
  if (!['old', 'new'].includes(d.regime)) { failed++; console.log('  FAIL: regime', d.regime); }
  if (normalized.taxpayer.assessmentYear !== d.assessmentYear) { failed++; console.log('  FAIL: AY mismatch'); }

  // Structural sanity — each head must be a finite number
  for (const k of ['salary', 'houseProperty', 'capitalGains', 'otherSources', 'grossTotal', 'totalIncome']) {
    if (typeof d.income[k] !== 'number' || !Number.isFinite(d.income[k])) { failed++; console.log(`  FAIL: income.${k}`, d.income[k]); }
  }
  if (typeof d.taxComputed.grossTaxLiability !== 'number') { failed++; console.log('  FAIL: grossTaxLiability'); }
}

console.log(failed === 0 ? '\nITR-2 smoke: PASS' : `\nITR-2 smoke: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);