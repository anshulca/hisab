/**
 * Behavioural test for the BUILT (obfuscated) protection script.
 * Loads dist/protection.js into a jsdom window and asserts that:
 *  - it runs without throwing and installs the credit badge
 *  - F12 / Ctrl+Shift+I / Ctrl+U / Ctrl+P / right-click trigger the shield
 *  - Ctrl+C works inside input fields (API-key box scenario)
 *  - shield is hidden by default
 * Usage: node scripts/test-protection.mjs
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(resolve(root, 'dist', 'protection.js'), 'utf8');

const out = console.log.bind(console);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><input id="txt" type="text"></body></html>', {
  pretendToBeVisual: true,
  url: 'https://hisab.studyfromnotes.com/'
});
const win = dom.window;
const doc = win.document;

const fn = new win.Function(
  'window', 'document', 'location', 'navigator', 'setInterval', 'setTimeout',
  'HTMLElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'console', code
);
fn(win, doc, win.location, win.navigator, win.setInterval, win.setTimeout,
  win.HTMLElement, win.Event, win.KeyboardEvent, win.MouseEvent, win.CustomEvent,
  { log: out, error: out });

const results = [];
const check = (label, ok) => { results.push([label, ok]); };

const shieldVisible = () => {
  const s = doc.getElementById('hisab-shield-layer');
  return !!s && s.style.display === 'flex';
};
const fireKey = (init) => {
  const ev = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  doc.dispatchEvent(ev);
  return ev.defaultPrevented;
};

check('script runs & badge installed', doc.body.textContent.includes('Made with ♥ by CA Anshul Karwa'));
check('shield hidden by default', !shieldVisible());

check('F12 blocked + shield', fireKey({ key: 'F12' }) && shieldVisible());
doc.getElementById('hisab-shield-layer').style.display = 'none';
check('Ctrl+Shift+I blocked + shield', fireKey({ key: 'I', ctrlKey: true, shiftKey: true }) && shieldVisible());
doc.getElementById('hisab-shield-layer').style.display = 'none';
check('Ctrl+U blocked + shield', fireKey({ key: 'u', ctrlKey: true }) && shieldVisible());
doc.getElementById('hisab-shield-layer').style.display = 'none';
check('Ctrl+P blocked + shield', fireKey({ key: 'p', ctrlKey: true }) && shieldVisible());
doc.getElementById('hisab-shield-layer').style.display = 'none';
check('Ctrl+A blocked (non-input)', fireKey({ key: 'a', ctrlKey: true }) && shieldVisible());
doc.getElementById('hisab-shield-layer').style.display = 'none';

const input = doc.getElementById('txt');
const copyOnInput = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'c', ctrlKey: true });
input.dispatchEvent(copyOnInput);
check('Ctrl+C allowed inside input', !copyOnInput.defaultPrevented && !shieldVisible());

const ctx = new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
doc.dispatchEvent(ctx);
check('right-click shows shield', ctx.defaultPrevented && shieldVisible());

const sel = new win.Event('selectstart', { bubbles: true, cancelable: true });
input.dispatchEvent(sel);
check('selection allowed inside input', !sel.defaultPrevented);

let failed = 0;
for (const [label, ok] of results) {
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed++;
}
out(failed === 0 ? '\nPROTECTION TEST: PASS' : `\nPROTECTION TEST: ${failed} FAILURE(S)`);
process.exit(failed ? 1 : 0);