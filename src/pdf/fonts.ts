import type { jsPDF } from 'jspdf';

const FONT_FILES = ['Roboto-Regular.ttf', 'Roboto-Bold.ttf'] as const;

const cache = new Map<string, string>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFont(name: string): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;

  const base = typeof document !== 'undefined' && document.baseURI ? document.baseURI : '';
  const url = new URL(`./fonts/${name}`, base).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${name} for the PDF (HTTP ${res.status}).`);
  const base64 = arrayBufferToBase64(await res.arrayBuffer());
  cache.set(name, base64);
  return base64;
}

export function preloadFonts(map: Record<string, string>): void {
  for (const name of FONT_FILES) {
    if (map[name]) cache.set(name, map[name]);
  }
}

let fontPromise: Promise<void> | null = null;

export function ensureRupeeFont(doc: jsPDF): Promise<void> {
  if (!fontPromise) {
    fontPromise = Promise.all(FONT_FILES.map(loadFont)).then(() => undefined);
  }
  return fontPromise.then(() => {
    doc.addFileToVFS('Roboto-Regular.ttf', cache.get('Roboto-Regular.ttf')!);
    doc.addFileToVFS('Roboto-Bold.ttf', cache.get('Roboto-Bold.ttf')!);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  });
}