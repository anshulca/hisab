/**
 * Usage-restriction test: free-tier limit, record increments, and admin token
 * unlock (query-token digest). Bundles usageStore with esbuild because Node
 * cannot import extensionless .ts directly. A tiny localStorage shim emulates
 * the browser persistence layer.
 * Usage: node scripts/access-test.mjs
 */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tmpDir = resolve(root, '.tmp');
const out = resolve(tmpDir, 'usage-store.mjs');

await build({
  entryPoints: [resolve(root, 'src/access/usageStore.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  mainFields: ['module', 'main'],
  alias: { qrcode: resolve(root, 'scripts/stubs/qrcode-stub.mjs') },
  outfile: out,
  logLevel: 'error'
});

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); }
};
globalThis.window = { location: { href: 'https://localhost/' } };

const m = await import(pathToFileURL(out).href + '?t=' + Date.now());
const { useUsageStore, FREE_REPORT_LIMIT, isDownloadAllowed, isAdminActive, freeReportsRemaining, tryUnlockAdminFromUrl, adminTokenHashOf } = m;

let failed = 0;
const check = (cond, msg) => { if (!cond) { console.log('  FAIL: ' + msg); failed++; } };

// Fresh state
useUsageStore.setState({ pdfDownloads: 0, adminUnlocked: false, limitModalOpen: false });
check(useUsageStore.getState().pdfDownloads === 0, 'starts at 0 downloads');

// 1. Free limit: 3 allowed, then blocked.
console.log('--- free tier ---');
for (let i = 0; i < FREE_REPORT_LIMIT; i++) {
  check(isDownloadAllowed(), `download ${i + 1} allowed`);
  useUsageStore.getState().recordDownload();
}
check(!isDownloadAllowed(), 'download blocked after limit');
check(freeReportsRemaining() === 0, '0 free remaining');
check(isAdminActive() === false, 'not admin yet');

// 2. Reject wrong token.
console.log('--- admin unlock ---');
const wrong = await tryUnlockAdminFromUrl('https://localhost/?admin=WRONG');
check(wrong === false, 'wrong token rejected');
check(isAdminActive() === false, 'still not admin after wrong token');

// 3. Accept correct token.
const goodHash = await adminTokenHashOf('HISAB-OPEN-ADMIN-8C2F41');
const correct = await tryUnlockAdminFromUrl('https://localhost/?admin=HISAB-OPEN-ADMIN-8C2F41');
check(correct === true, 'correct token unlocks admin');
check(isAdminActive() === true, 'admin active after unlock');
check(goodHash === 'B1E3331B3DC607BEEFE33B06B283EE6B19F6E3847FF7C316C448B6F7827095B1', 'token hash matches configured digest');

// 4. Admin is unlimited (downloads allowed even though over the free limit).
check(isDownloadAllowed() === true, 'admin download allowed beyond free limit');
check(freeReportsRemaining() === Infinity, 'unlimited remaining for admin');

// 5. Persistence survives a "reload" (store was written to localStorage).
const reloaded = useUsageStore.persist.rehydrate();
await reloaded;
check(useUsageStore.getState().adminUnlocked === true, 'admin state persisted in localStorage');
check(useUsageStore.getState().pdfDownloads === FREE_REPORT_LIMIT, 'download count persisted in localStorage');

// 6. Modal flags are in-memory, not persisted.
useUsageStore.getState().openLimitModal();
check(useUsageStore.getState().limitModalOpen === true, 'modal opens');
check(localStorage.getItem('hisab-usage-v1').includes('limitModalOpen') === false, 'modal flag not persisted');
useUsageStore.getState().closeLimitModal();
check(useUsageStore.getState().limitModalOpen === false, 'modal closes');

console.log(failed === 0 ? '\nAccess test: PASS' : `\nAccess test: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);