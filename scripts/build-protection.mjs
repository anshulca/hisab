/**
 * Post-build step for the HISAB protection script.
 * 1. Bundles src/protection/entry.ts into a standalone IIFE via esbuild.
 * 2. Obfuscates it with javascript-obfuscator hardened settings
 *    (debugProtection, disableConsoleOutput, selfDefending).
 * 3. Injects a classic script tag into dist/index.html <head> so the guards
 *    attach eagerly — before the React bundle even loads.
 * Usage: node scripts/build-protection.mjs
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(dist, 'protection.js');

await build({
  entryPoints: [resolve(root, 'src/protection/entry.ts')],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
  outfile: output,
  logLevel: 'error'
});

const code = readFileSync(output, 'utf8');

const obfuscated = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  target: 'browser',
  debugProtection: true,
  debugProtectionInterval: 3500,
  disableConsoleOutput: true,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64']
}).getObfuscatedCode();

writeFileSync(output, obfuscated);
if (existsSync(output + '.map')) rmSync(output + '.map');
if (existsSync(output + '.LICENSE.txt')) rmSync(output + '.LICENSE.txt');

const htmlPath = resolve(dist, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const tagPattern = /<script src="\.\/protection\.js\?v=[^"]*"><\/script>/;
if (!tagPattern.test(html)) {
  const version = Buffer.from(obfuscated).toString('base64').slice(0, 8).replace(/[^a-z0-9]/gi, '');
  html = html.replace('<head>', `<head>\n    <script src="./protection.js?v=${version}"></script>`);
  writeFileSync(htmlPath, html);
}

console.log(`Protection built: protection.js (${obfuscated.length} bytes) injected into index.html.`);