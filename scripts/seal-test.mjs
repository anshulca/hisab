/**
 * Seal e2e test: build a genuine ITR-2 report, seal it, and verify the
 * byte-level integrity round-trip (tamper-evident hash) holds.
 * Usage: node scripts/seal-test.mjs
 */
import { build } from 'esbuild';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tmpDir = resolve(root, '.tmp');
const parserOut = resolve(tmpDir, 'itr2-parser.mjs');
const pdfOut = resolve(tmpDir, 'itr2-pdf.mjs');
const sealOut = resolve(tmpDir, 'seal.mjs');

await build({
  entryPoints: [resolve(root, 'src/itr2/parser.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: parserOut,
  logLevel: 'error'
});

await build({
  entryPoints: [resolve(root, 'src/itr2/pdf.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  mainFields: ['module', 'main'],
  alias: {
    'jspdf-autotable': 'jspdf-autotable/es',
    qrcode: resolve(root, 'scripts/stubs/qrcode-stub.mjs')
  },
  outfile: pdfOut,
  logLevel: 'error'
});

await build({
  entryPoints: [resolve(root, 'src/pdf/seal.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  mainFields: ['module', 'main'],
  alias: {
    'jspdf-autotable': 'jspdf-autotable/es',
    qrcode: resolve(root, 'scripts/stubs/qrcode-stub.mjs')
  },
  outfile: sealOut,
  logLevel: 'error'
});

globalThis.document = { baseURI: 'https://localhost/' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const m = String(url).match(/fonts\/([A-Za-z0-9._-]+\.ttf)/);
  if (m) {
    const p = resolve(root, 'public', 'fonts', m[1]);
    if (existsSync(p)) {
      return { arrayBuffer: async () => readFileSync(p), ok: true, status: 200 };
    }
  }
  return realFetch(url);
};

const { buildItr2Pdf } = await import(pathToFileURL(pdfOut).href + '?t=' + Date.now());
const { parseItr2 } = await import(pathToFileURL(parserOut).href + '?t=' + Date.now());
const { sealReport, verifyReportFile, generateReportId } = await import(pathToFileURL(sealOut).href + '?t=' + Date.now());

const fixtures = ['test-data/ITR2_JSon_R-088.json', 'test-data/231625900300724.json'];
let failed = 0;

for (const f of fixtures) {
  const { normalized } = parseItr2(readFileSync(resolve(root, f), 'utf8'));
  try {
    const doc = await buildItr2Pdf(normalized);
    const reportId = generateReportId('ITR-2');
    const sealed = await sealReport(doc, {
      itrType: normalized.itrForm ?? 'ITR-2',
      assessmentYear: normalized.taxpayer.assessmentYear,
      reportId
    });

    if (sealed.meta.reportId !== reportId) { console.log(`${f}: reportId mismatch`); failed++; }

    // 1. Tamper-free round trip must verify.
    const v1 = await verifyReportFile(sealed.bytes);
    if (v1.status !== 'verified') { console.log(`${f}: clean file should verify (got ${v1.status})`); failed++; }

    // 2. A single mutated byte must fail.
    const tampered = sealed.bytes.slice();
    tampered[tampered.length - 20] ^= 0xff;
    const v2 = await verifyReportFile(tampered);
    if (v2.status !== 'not-verifiable') { console.log(`${f}: tampered file should fail (got ${v2.status})`); failed++; }

    // 3. QR/byte reality check: the file actually contains the report id and a hash placeholder-free 64-hex hash.
    let latin = '';
    for (let i = 0; i < sealed.bytes.length; i++) latin += String.fromCharCode(sealed.bytes[i]);
    const idInFile = latin.includes(reportId);
    if (!idInFile) { console.log(`${f}: report id not found in bytes`); failed++; }
    if (!/^[0-9A-F]{64}$/.test(v1.integrityHash || '')) { console.log(`${f}: no 64-hex integrity hash recorded`); failed++; }

    writeFileSync(resolve(tmpDir, `${f.replace(/[\\/]/g, '_')}.sealed.pdf`), Buffer.from(sealed.bytes));

    console.log(`${f}: sealed OK (${sealed.bytes.length} bytes, id ${reportId}, hash ${sealed.meta.integrityHash.slice(0, 12)}…)`);
  } catch (e) {
    console.log(`${f}: SEAL FAIL — ${e.message}`);
    failed++;
  }
}

console.log(failed === 0 ? '\nSeal test: PASS' : `\nSeal test: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);