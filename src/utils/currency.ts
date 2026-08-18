/**
 * Format a number as Indian Rupee currency with proper comma separation
 * Example: 14526643 → ₹1,45,26,643 (1.45 Crore)
 * Example: 1030285 → ₹10,30,285 (10.30 Lakh)
 * Example: 392799 → ₹3,92,799 (3.92 Lakh)
 */
export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return '₹0';
  }

  const num = Math.round(amount);

  // Convert to string and handle Indian number system
  let str = num.toString();
  let result = '';

  // Handle negative numbers
  let isNegative = false;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1);
  }

  // Indian numbering system: last 3 digits, then groups of 2
  const lastThree = str.slice(-3);
  const other = str.slice(0, -3);

  if (other !== '') {
    result = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    result = lastThree;
  }

  return (isNegative ? '-₹' : '₹') + result;
}

/**
 * Format currency without ₹ symbol for tables
 */
export function formatCurrencyPlain(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return '0';
  }

  const num = Math.round(amount);
  let str = num.toString();
  let result = '';

  if (str.startsWith('-')) {
    str = str.substring(1);
  }

  const lastThree = str.slice(-3);
  const other = str.slice(0, -3);

  if (other !== '') {
    result = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    result = lastThree;
  }

  return result;
}

/**
 * Right-align currency with fixed width (for tables)
 * Ensures all amounts align perfectly to the right
 */
export function rightAlignCurrency(amount: number, width: number = 14): string {
  const formatted = formatCurrency(amount);
  return formatted.padStart(width);
}

/**
 * Right-align currency without ₹ symbol
 */
export function rightAlignCurrencyPlain(amount: number, width: number = 14): string {
  const formatted = formatCurrencyPlain(amount);
  return formatted.padStart(width);
}

/**
 * Clean a number from JSON (remove extra zeros, fix formatting)
 */
export function cleanNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : (value as number);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Format for display in reports with proper Indian number system
 */
export function displayAmount(amount: number, showRupee: boolean = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showRupee ? '₹0' : '0';
  }
  return showRupee ? formatCurrency(amount) : formatCurrencyPlain(amount);
}

/* ============ Legacy app utilities (kept for compatibility) ============ */

export function formatINR(amount: number, options: { noDecimals?: boolean; sign?: boolean } = {}): string {
  const value = Math.round(amount);
  const sign = options.sign && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-IN');
  if (options.noDecimals) return `${sign}₹${formatted}`;
  return `${sign}₹${formatted}.00`;
}

export function formatLakhs(amount: number): string {
  const lakhs = amount / 100000;
  return `${lakhs.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
}

export function formatCrores(amount: number): string {
  const crores = amount / 10000000;
  return `${crores.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
}

export function compactINR(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${formatCrores(amount)}`;
  if (abs >= 100000) return `₹${formatLakhs(amount)}`;
  if (abs >= 1000) return `₹${(amount / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,₹\s]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function amountToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigit(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function threeDigit(n: number): string {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let result = '';
    if (hundred) result += ones[hundred] + ' Hundred';
    if (rest) result += (result ? ' and ' : '') + twoDigit(rest);
    return result;
  }

  function indianWords(n: number): string {
    if (n === 0) return 'Zero';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    let result = '';
    if (crore) result += indianWords(crore) + ' Crore ';
    if (lakh) result += twoDigit(lakh) + ' Lakh ';
    if (thousand) result += twoDigit(thousand) + ' Thousand';
    if (rest) result += (result ? (thousand ? ' ' : ' and ') : '') + threeDigit(rest);
    return result.trim();
  }

  return indianWords(Math.round(amount)) + ' Rupees Only';
}