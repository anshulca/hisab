import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NormalizedITR, ReportSection } from '../types';
import { formatINR } from '../utils/currency';
import { generateReport } from '../reports/reportGenerator';

const INK: [number, number, number] = [26, 27, 34];
const GOLD: [number, number, number] = [184, 139, 58];
const MUTED: [number, number, number] = [138, 134, 144];

export interface PdfOptions {
  fileName?: string;
  includeCover?: boolean;
}

export function generatePdf(normalized: NormalizedITR, options: PdfOptions = {}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const sections = generateReport(normalized);
  const fileName = options.fileName ?? `HISAB_${normalized.taxpayer.pan}_${normalized.taxpayer.assessmentYear.replace('-', '_')}.pdf`;

  if (options.includeCover !== false) {
    renderCover(doc, normalized);
  }

  for (const section of sections) {
    if (section.id === 'cover') continue;
    renderSection(doc, section);
  }

  renderPageDecor(doc);

  doc.save(fileName);
}

function renderCover(doc: jsPDF, n: NormalizedITR) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setFillColor(10, 11, 18);
  doc.rect(0, 0, width, height, 'F');

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 0, 6, height, 'F');

  doc.setTextColor(245, 230, 176);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(44);
  doc.text('HISAB', 70, 130);

  doc.setTextColor(240, 237, 232);
  doc.setFontSize(16);
  doc.text('ITR Computation Report', 70, 160);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(181, 176, 171);
  doc.text('Generated with HISAB v1.0.0 - JSON se Computation tak', 70, 186);

  doc.setFontSize(20);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('PREPARED FOR', 70, 280);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(240, 237, 232);
  doc.text(n.taxpayer.name, 70, 310);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(181, 176, 171);

  doc.setFontSize(12);
  doc.text(`PAN: ${n.taxpayer.pan}`, 70, 340);
  doc.text(`Assessment Year: ${n.taxpayer.assessmentYear}`, 70, 360);
  doc.text(`Nature of Business: ${n.taxpayer.profession ?? n.taxpayer.type}`, 70, 380);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`Gross Total Income: ${formatINR(n.incomeBreakdown.total)}`, 70, 430);

  doc.setFontSize(12);
  doc.text(`Net Tax Payable: ${formatINR(n.taxComputation.netTaxPayable)}`, 70, 454);

  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(1);
  doc.line(70, 500, width - 70, 500);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(138, 134, 144);
  doc.text('Prepared by: CA Anshul Karwa', 70, 520);
  doc.text('hisab.studyfromnotes.com', 70, 538);
}

function renderSection(doc: jsPDF, section: ReportSection) {
  doc.addPage();
  const margin = 54;
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(10, 11, 18);
  doc.rect(0, 0, width, 84, 'F');

  doc.setTextColor(245, 230, 176);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(section.title, margin, 52);

  doc.setTextColor(138, 134, 144);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`HISAB · ${section.id.toUpperCase()}`, margin, 72);

  let cursorY = 106;

  if (section.summary) {
    doc.setTextColor(90, 90, 100);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(section.summary, width - margin * 2);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 14 + 10;
  }

  const body = section.details.map((d) => [
    d.label,
    typeof d.value === 'number' ? formatINR(d.value) : String(d.value)
  ]);

  if (body.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Particulars', 'Amount']],
      body,
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 10,
        textColor: INK as unknown as string,
        cellPadding: 8
      },
      headStyles: {
        fillColor: GOLD as unknown as string,
        textColor: [10, 11, 18] as unknown as string,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [247, 245, 240] as unknown as string }
    });
  }

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
  if (finalY > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Prepared by CA Anshul Karwa · HISAB ITR Computation Engine', margin, doc.internal.pageSize.getHeight() - 30);
  }
}

function renderPageDecor(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = doc as any;

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    try {
      pdf.setGState(new pdf.GState({ opacity: 0.09 }));
    } catch {
      /* GState unsupported - skip watermark */
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(40);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    const step = 120;
    for (let row = 0; row <= Math.ceil(height / step); row++) {
      doc.text('CA Anshul Karwa · HISAB', width / 2, row * step + 60, { angle: 40, align: 'center' });
    }
    try {
      pdf.setGState(new pdf.GState({ opacity: 1 }));
    } catch {
      /* ignore */
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Made by CA Anshul Karwa', width / 2, 26, { align: 'center' });
    doc.text('Made by CA Anshul Karwa', width / 2, height - 12, { align: 'center' });
    doc.text(`Page ${i} of ${pages}`, width - 54, height - 18, { align: 'right' });
  }
}