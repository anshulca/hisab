/**
 * ITR-3 smoke test — parse the genuine fixtures and sanity-report key figures.
 * Bundles the parser with esbuild (Node cannot import extensionless .ts directly).
 * Usage: node scripts/itr3-smoke.mjs
 */
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = resolve(here, '..', '.tmp');
const out = resolve(tmpDir, 'itr3-parser-smoke.mjs');

await build({
  entryPoints: ['src/itr3/parser.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error'
});

const { parseItr3 } = await import(pathToFileURL(out).href + '?t=' + Date.now());

const fixtures = [
  'test-data/itr3_ankiet_genuine.json',
  'test-data/itr3_anant_genuine.json'
];

let failed = 0;
for (const f of fixtures) {
  const raw = readFileSync(f, 'utf8');
  const { normalized, issues } = parseItr3(raw);
  const d = normalized.itr3;
  const label = `${normalized.taxpayer.name} · PAN ${normalized.taxpayer.pan} · AY ${d.assessmentYear}`;
  console.log(`\n=== ${f.split(/[\\/]/).pop()} ===`);
  console.log(label);
  console.log('  income:', JSON.stringify(d.income));
  console.log('  tax:', JSON.stringify(d.taxComputed));
  console.log('  taxesPaid.total:', d.taxesPaid.total, '| refund:', d.refund.refundDue);
  console.log('  reportSections:', normalized.reportSections.map((s) => s.id).join(', '));
  console.log('  issues:', issues.length ? issues.map((i) => i.message).join(' | ') : 'none');

  if (d.assessmentYear !== '2026-27') { failed++; console.log('  FAIL: assessmentYear', d.assessmentYear); }
  if (normalized.reportSections.length < 4) { failed++; console.log('  FAIL: too few report sections'); }
}

console.log(failed === 0 ? '\nITR-3 smoke: PASS' : `\nITR-3 smoke: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);