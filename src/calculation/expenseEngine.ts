import type { ExpenseItem, ExpenseSummary } from '../types';

export interface ExpenseCategoryMap {
  [key: string]: string;
}

export const EXPENSE_CATEGORY_ALIASES: ExpenseCategoryMap = {
  'salaries': 'Salaries & Wages',
  'salary': 'Salaries & Wages',
  'wages': 'Salaries & Wages',
  'staff': 'Salaries & Wages',
  'rent': 'Rent',
  'electricity': 'Utilities',
  'power': 'Utilities',
  'utilities': 'Utilities',
  'telephone': 'Telephone & Internet',
  'internet': 'Telephone & Internet',
  'repairs': 'Repairs',
  'repair': 'Repairs',
  'maintenance': 'Repairs & Maintenance',
  'travel': 'Travel',
  'conveyance': 'Travel',
  'fuel': 'Travel',
  'purchases': 'Purchases',
  'purchase': 'Purchases',
  'cogs': 'Purchases',
  'raw': 'Purchases',
  'advertising': 'Marketing',
  'marketing': 'Marketing',
  'promotion': 'Marketing',
  'professional': 'Professional Fees',
  'fees': 'Professional Fees',
  'legal': 'Professional Fees',
  'consulting': 'Professional Fees',
  'insurance': 'Insurance',
  'bank': 'Bank Charges',
  'interest': 'Interest',
  'software': 'Software & Subscriptions',
  'subscription': 'Software & Subscriptions',
  'commission': 'Commission',
  'printing': 'Printing & Stationery',
  'stationery': 'Printing & Stationery',
  'misc': 'Miscellaneous',
  'miscellaneous': 'Miscellaneous',
  'other': 'Miscellaneous',
  'others': 'Miscellaneous'
};

export function normalizeExpenseCategory(key: string): string {
  const cleaned = key.toLowerCase().replace(/[^a-z]/g, '');
  return EXPENSE_CATEGORY_ALIASES[cleaned] ?? EXPENSE_CATEGORY_ALIASES[key.toLowerCase()] ?? 'Miscellaneous';
}

export interface RawExpense {
  category?: string;
  label?: string;
  amount?: number;
  value?: number;
  [key: string]: unknown;
}

export function parseExpenseItems(raw: unknown, categoryOrder?: string[]): ExpenseSummary {
  if (!Array.isArray(raw)) {
    return { total: 0, items: [] };
  }

  const grouped = new Map<string, number>();

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as RawExpense;
    const rawAmount = e.amount ?? e.value ?? 0;
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount)) || 0;
    const category = e.category || e.label || 'Miscellaneous';
    const normalized = normalizeExpenseCategory(String(category));
    grouped.set(normalized, (grouped.get(normalized) ?? 0) + amount);
  }

  const items: ExpenseItem[] = Array.from(grouped.entries())
    .filter(([, amount]) => amount !== 0)
    .map(([category, amount], index) => ({
      id: `expense-${index}`,
      category,
      label: category,
      amount
    }));

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  items.sort((a, b) => b.amount - a.amount);
  if (categoryOrder && categoryOrder.length > 0) {
    items.sort((a, b) => {
      const ai = categoryOrder.indexOf(a.category);
      const bi = categoryOrder.indexOf(b.category);
      if (ai === -1 && bi === -1) return b.amount - a.amount;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  items.forEach((item) => {
    item.percentage = total > 0 ? (item.amount / total) * 100 : 0;
  });

  return { total, items };
}