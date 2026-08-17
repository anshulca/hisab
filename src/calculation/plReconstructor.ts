import type { ExpenseItem, PnLStatement } from '../types';

export interface PlReconstructionInput {
  revenue: number;
  cogs: number;
  expenses: ExpenseItem[];
  depreciation: number;
  otherIncome: number;
}

export function reconstructPnl(input: PlReconstructionInput): PnLStatement {
  const { revenue, cogs, expenses, depreciation, otherIncome } = input;

  const grossProfit = revenue - cogs;
  const totalOperatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const ebitda = grossProfit - totalOperatingExpenses;
  const operatingProfit = ebitda - depreciation;
  const netProfit = operatingProfit + otherIncome;

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: totalOperatingExpenses,
    depreciation,
    operatingProfit,
    otherIncome,
    ebitda,
    netProfit,
    margins: {
      gross: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      operating: revenue > 0 ? (operatingProfit / revenue) * 100 : 0,
      net: revenue > 0 ? (netProfit / revenue) * 100 : 0
    }
  };
}

export function defaultPnL(): PnLStatement {
  return {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    depreciation: 0,
    operatingProfit: 0,
    otherIncome: 0,
    ebitda: 0,
    netProfit: 0,
    margins: { gross: 0, operating: 0, net: 0 }
  };
}