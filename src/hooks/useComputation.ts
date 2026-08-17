import { useMemo } from 'react';
import { useComputationStore } from '../store/computationStore';
import { reconstructPnl, defaultPnL } from '../calculation/plReconstructor';

export function useComputation() {
  const normalizedData = useComputationStore((state) => state.normalizedData);
  const depreciationAssets = useComputationStore((state) => state.depreciationAssets);

  const pnl = useMemo(() => {
    if (!normalizedData) return defaultPnL();

    const income = normalizedData.incomeBreakdown;
    const expenses = normalizedData.expenseSummary.items;
    const depreciation = normalizedData.depreciation.totalDepreciation;
    const revenue = income.grossReceipts > 0 ? income.grossReceipts : income.businessIncome;

    if (expenses.length === 0) {
      const netProfit = income.businessIncome;
      return {
        revenue,
        cogs: 0,
        grossProfit: netProfit,
        expenses: 0,
        depreciation: 0,
        operatingProfit: netProfit,
        otherIncome: income.otherSources,
        ebitda: netProfit,
        netProfit,
        margins: {
          gross: revenue > 0 ? (netProfit / revenue) * 100 : 0,
          operating: revenue > 0 ? (netProfit / revenue) * 100 : 0,
          net: revenue > 0 ? (netProfit / revenue) * 100 : 0
        }
      };
    }

    const cogs = expenses.find((e) => e.category === 'Purchases')?.amount ?? 0;
    const otherExpenses = expenses.filter((e) => e.category !== 'Purchases');

    return reconstructPnl({
      revenue,
      cogs,
      expenses: otherExpenses,
      depreciation,
      otherIncome: income.otherSources
    });
  }, [normalizedData]);

  return {
    normalizedData,
    taxpayer: normalizedData?.taxpayer ?? null,
    income: normalizedData?.incomeBreakdown ?? null,
    expenses: normalizedData?.expenseSummary ?? null,
    depreciation: depreciationAssets,
    tax: normalizedData?.taxComputation ?? null,
    reportSections: normalizedData?.reportSections ?? [],
    pnl,
    isReady: Boolean(normalizedData)
  };
}