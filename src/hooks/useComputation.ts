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
    const cogs = expenses.find((e) => e.category === 'Purchases')?.amount ?? 0;
    const otherExpenses = expenses.filter((e) => e.category !== 'Purchases');
    const revenue = income.grossReceipts > 0 ? income.grossReceipts : income.businessIncome;

    return reconstructPnl({
      revenue,
      cogs,
      expenses: otherExpenses,
      depreciation: normalizedData.depreciation.totalDepreciation,
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