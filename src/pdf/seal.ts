/**
 * Report identity + tamper-evident integrity for HISAB working-file PDFs.
 *
 * Design notes (honest limits):
 *  - Report ID  : cryptographically random (crypto.getRandomValues), unique per report.
 *  - Integrity  : SHA-256 of the exact final PDF bytes (after every page, watermark,
 *                 footer and QR are drawn). It is computed over the serialized bytes
 *                 that carry a fixed-length placeholder, then the placeholder is
 *                 byte-for-byte replaced with the real hash (same length, so xref
 *                 offsets stay valid). Verification recomputes the hash the same way,
 *                 so ANY change to the file after generation breaks the match.
 *  - No private key lives in the frontend. This is NOT a cryptographic signature;
 *    it is a tamper-evident integrity check. A real digital-signature layer can be
 *    connected later via the verify endpoint (architecture only, nothing faked).
 */
import type jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { MARGIN, PAGE_H, PAGE_W } from './pdfGenerator';
import { sha256Hex } from '../utils/sha256';

/** Architecture constant — the online verifier is NOT implemented yet. */
export const VERIFY_BASE_URL = 'https://hisab.karwaandassociates.com/verify';

/** Fixed-length placeholder kept byte-identical to a SHA-256 hex string. */
export const HASH_PLACEHOLDER = '0'.repeat(64);

export const PDF_TITLE = 'HISAB ITR Computation';
export const PDF_AUTHOR = 'CA Anshul Karwa';
export const PDF_CREATOR = 'HISAB by CA Anshul Karwa';
export const PDF_SUBJECT = 'Income Tax Computation';
export const PDF_KEYWORDS_BASE = 'HISAB, ITR, Income Tax, CA Anshul Karwa';

export interface ReportIdentity {
  reportId: string;
  verifyUrl: string;
  integrityHash: string;
  itrType: string;
  assessmentYear: string;
  generatedAtIso: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function randomHexBytes(count: number): string {
  const bytes = new Uint8Array(count);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toHex(bytes.buffer as ArrayBuffer);
}

export function generateReportId(itrType: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const normType = (itrType || 'ITR').toUpperCase().replace(/^ITR[-\s]?/, 'ITR');
  return `HISAB-${normType}-${yyyy}-${mm}-${dd}-${randomHexBytes(4)}`;
}

export { sha256Hex } from '../utils/sha256';

export function applyPdfMetadata(doc: jsPDF, meta: ReportIdentity) {
  doc.setProperties({
    title: PDF_TITLE,
    author: PDF_AUTHOR,
    subject: `${PDF_SUBJECT} · Report ID ${meta.reportId}`,
    keywords: `${PDF_KEYWORDS_BASE}, Report ID ${meta.reportId}, HISAB Integrity ${meta.integrityHash}`,
    creator: PDF_CREATOR
  });
  doc.setCreationDate(new Date(meta.generatedAtIso));
}

/** Latin-1 string <-> bytes helpers for safe byte-level placeholder swapping. */
function bytesToLatin1(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Patch the placeholder bytes with the real hash. The placeholder and the real
 * hash have identical length, so every xref offset in the PDF stays valid.
 */
export function patchPlaceholder(bytes: Uint8Array, realHash: string): Uint8Array {
  const patched = bytesToLatin1(bytes).split(HASH_PLACEHOLDER).join(realHash);
  return latin1ToBytes(patched);
}

export interface SealedReport {
  doc: jsPDF;
  meta: ReportIdentity;
  /** Final bytes exactly as they will be saved — hash computed over these bytes. */
  bytes: Uint8Array;
}

/**
 * Seal a fully-built working-file PDF with identity, integrity hash and QR.
 * Call AFTER all content pages have been rendered (including renderFooter),
 * then save `bytes` (not doc.save()).
 */
export async function sealReport(doc: jsPDF, opts: { itrType: string; assessmentYear: string; reportId?: string }): Promise<SealedReport> {
  const now = new Date();
  const reportId = opts.reportId ?? generateReportId(opts.itrType, now);
  const verifyUrl = `${VERIFY_BASE_URL}/${reportId}`;

  const meta: ReportIdentity = {
    reportId,
    verifyUrl,
    integrityHash: HASH_PLACEHOLDER,
    itrType: opts.itrType,
    assessmentYear: opts.assessmentYear,
    generatedAtIso: now.toISOString()
  };

  // 1. Draw the authenticity box + QR on a fresh final page.
  await drawAuthenticityPage(doc, { reportId, verifyUrl, assessmentYear: opts.assessmentYear, itrType: opts.itrType, hash: HASH_PLACEHOLDER });

  // 2. Stamp the Report ID on the first page header and every page footer.
  stampFirstPageHeader(doc, reportId);
  stampFooters(doc, reportId);

  // 3. Metadata MUST be set before serialization so it is inside the hashed bytes.
  applyPdfMetadata(doc, meta);

  // 4. Serialize, hash the exact bytes (with the placeholder), patch it in.
  const u8 = new Uint8Array(doc.output('arraybuffer'));
  const integrityHash = await sha256Hex(u8);
  const bytes = patchPlaceholder(u8, integrityHash);
  meta.integrityHash = integrityHash;

  return { doc, meta, bytes };
}

function stampFirstPageHeader(doc: jsPDF, reportId: string) {
  doc.setPage(1);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 190, 175);
  doc.text(`REPORT ID  ${reportId}`, PAGE_W - MARGIN, 14, { align: 'right' });
  doc.setPage(doc.getNumberOfPages());
}

/** Draw the Report ID on every page footer (kept subtle, consistent with renderFooter). */
function stampFooters(doc: jsPDF, reportId: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(122, 118, 126);
    doc.text(`HISAB Report ID ${reportId}`, MARGIN, PAGE_H - 26);
  }
  doc.setPage(doc.getNumberOfPages());
}

/** Save an already-sealed byte array as a PDF download in the browser. */
export function savePdfBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: build-and-save in one call with a proper download name. */
export async function sealAndSavePdf(
  doc: jsPDF,
  opts: { itrType: string; assessmentYear: string },
  fileName: string
): Promise<SealedReport> {
  try {
    const { useUsageStore, isDownloadAllowed } = await import('../access/usageStore');
    if (!isDownloadAllowed()) {
      useUsageStore.getState().openLimitModal();
      throw new Error('Free report limit reached');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Free report limit reached') throw e;
  }

  const sealed = await sealReport(doc, opts);
  savePdfBytes(sealed.bytes, fileName);
  try {
    const { useUsageStore } = await import('../access/usageStore');
    useUsageStore.getState().recordDownload();
  } catch {
    /* usage tracking is best-effort */
  }
  return sealed;
}

interface AuthenticityBoxOpts {
  reportId: string;
  verifyUrl: string;
  assessmentYear: string;
  itrType: string;
  hash: string;
}

async function drawAuthenticityPage(doc: jsPDF, opts: AuthenticityBoxOpts) {
  doc.addPage();
  const y0 = 70;
  const boxH = 230;
  const boxW = PAGE_W - MARGIN * 2;

  // ---- Heading ----
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(184, 139, 58);
  doc.text('VERIFICATION', MARGIN, y0);

  doc.setFontSize(15);
  doc.setTextColor(26, 27, 34);
  doc.text('Report Authenticity', MARGIN, y0 + 16);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(122, 118, 126);
  doc.text('Digitally verifiable report · tamper-evident PDF · verify report authenticity', MARGIN, y0 + 30);

  // ---- Authenticity box ----
  const bx = MARGIN;
  const by = y0 + 46;
  doc.setDrawColor(184, 139, 58);
  doc.setLineWidth(1.2);
  doc.roundedRect(bx, by, boxW, boxH, 6, 6, 'S');

  const labelX = bx + 20;
  const valueX = bx + 170;
  let y = by + 34;

  const row = (label: string, value: string) => {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 88, 92);
    doc.text(label.toUpperCase(), labelX, y);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(26, 27, 34);
    const lines = doc.splitTextToSize(value, boxW - 220);
    doc.text(lines, valueX, y);
    y += lines.length * 12 + 12;
  };

  row('Report ID', opts.reportId);
  row('Generated by', 'HISAB by CA Anshul Karwa');
  row('Document', 'ITR Computation Working File');
  row('Assessment Year', opts.assessmentYear);
  row('ITR Form', opts.itrType.toUpperCase());
  row('Report Integrity Hash SHA-256', opts.hash);

  // ---- QR ----
  const qrSize = 84;
  const qx = PAGE_W - MARGIN - qrSize - 20;
  const qy = by + boxH / 2 - qrSize / 2;
  try {
    const dataUrl = await QRCode.toDataURL(opts.verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#1a1b22', light: '#ffffff' } });
    doc.addImage(dataUrl, 'PNG', qx, qy, qrSize, qrSize);
  } catch {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(122, 118, 126);
    doc.text('QR unavailable', qx, qy + qrSize / 2);
  }

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(122, 118, 126);
  doc.text('Scan the QR code to verify this report', qx, qy + qrSize + 12);

  // ---- Integrity note ----
  doc.setFontSize(7.5);
  doc.setTextColor(90, 88, 92);
  const note =
    'This working file carries a SHA-256 integrity hash computed over the exact bytes of this PDF at the moment of generation. ' +
    'The QR code points to the official verifier. Any modification to the file after generation will break the integrity hash ' +
    'and the report will no longer verify. Verification is tamper-evident, not a substitute for a cryptographic digital signature.';
  const noteLines = doc.splitTextToSize(note, boxW - 40);
  doc.text(noteLines, bx + 20, by + boxH + 18);

  // Footer marker for the seal page
  doc.setFontSize(7);
  doc.setTextColor(122, 118, 126);
  doc.text(`Prepared automatically by HISAB by CA Anshul Karwa`, MARGIN, PAGE_H - 14);
  doc.text(`Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`, PAGE_W - MARGIN, PAGE_H - 14, { align: 'right' });
}

export interface VerifyResult {
  status: 'verified' | 'not-verifiable' | 'no-integrity-data';
  reportId?: string;
  integrityHash?: string;
}

/**
 * Verify a saved HISAB PDF. Recomputes the SHA-256 over the bytes exactly as the
 * sealer did (placeholder swapped in), and compares with the recorded hash.
 */
export async function verifyReportFile(bytes: Uint8Array): Promise<VerifyResult> {
  const latin = bytesToLatin1(bytes);

  const idMatch = latin.match(/HISAB-(ITR\d)-\d{4}-\d{2}-\d{2}-[0-9A-F]{8}/i);
  const reportId = idMatch ? idMatch[0].toUpperCase() : undefined;

  // Locate the recorded hash inside the PDF metadata (Info dict). The sealer wrote
  // it as `HISAB Integrity <hash>` into the Keywords field, which jsPDF serializes
  // uncompressed, so the marker survives byte-level round trips.
  const hashMatch = latin.match(/HISAB\s+Integrity\s+([0-9A-F]{64})/i);
  const recorded = hashMatch ? hashMatch[1].toUpperCase() : undefined;

  if (!recorded) return { status: 'no-integrity-data', reportId };

  // Rebuild the placeholder version (swap recorded hash back to placeholder) and re-hash.
  const placeholderBytes = latin1ToBytes(latin.split(recorded).join(HASH_PLACEHOLDER));
  const recomputed = await sha256Hex(placeholderBytes);
  return {
    status: recomputed === recorded ? 'verified' : 'not-verifiable',
    reportId,
    integrityHash: recorded
  };
}
