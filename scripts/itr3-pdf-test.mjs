/**
 * ITR-3 end-to-end test: parse the genuine fixtures, build the working-file PDF,
 * and verify real bytes come out. Bundles pdf.ts with esbuild because Node
 * cannot import extensionless .ts directly; a document/fetch shim emulates the
 * browser (static font serving + document.baseURI).
 * Usage: node scripts/itr3-pdf-test.mjs
 */
import { build } from 'esbuild';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tmpDir = resolve(root, '.tmp');
const parserOut = resolve(tmpDir, 'itr3-parser.mjs');
const pdfOut = resolve(tmpDir, 'itr3-pdf.mjs');

await build({
  entryPoints: [resolve(root, 'src/itr3/parser.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: parserOut,
  logLevel: 'error'
});

await build({
  entryPoints: [resolve(root, 'src/itr3/pdf.ts')],
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

const { buildItr3Pdf } = await import(pathToFileURL(pdfOut).href + '?t=' + Date.now());
const { parseItr3 } = await import(pathToFileURL(parserOut).href + '?t=' + Date.now());

const fixtures = ['test-data/itr3_ankiet_genuine.json', 'test-data/itr3_anant_genuine.json'];
let failed = 0;

for (const f of fixtures) {
  const { normalized } = parseItr3(readFileSync(resolve(root, f), 'utf8'));
  try {
    const doc = await buildItr3Pdf(normalized);
    const u8 = new Uint8Array(doc.output('arraybuffer'));
    const head = String.fromCharCode(...u8.subarray(0, 4));
    console.log(`${f}: PDF OK (${u8.byteLength} bytes, header "${head}")`);
    if (head !== '%PDF' || u8.byteLength < 10000) {
      failed++;
      console.log('  BAD output');
    }
  } catch (e) {
    console.log(`${f}: PDF FAIL — ${e.message}`);
    failed++;
  }
}

console.log(failed === 0 ? '\nITR-3 PDF test: PASS' : `\nITR-3 PDF test: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);