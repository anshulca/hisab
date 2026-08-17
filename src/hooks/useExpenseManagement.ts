import { useCallback, useMemo, useState } from 'react';
import type { ExpenseItem } from '../types';
import { useComputationStore } from '../store/computationStore';

export function useExpenseManagement() {
  const normalizedData = useComputationStore((state) => state.normalizedData);

  const [localItems, setLocalItems] = useState<ExpenseItem[]>(() => normalizedData?.expenseSummary.items ?? []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const syncFromStore = useCallback(() => {
    const items = useComputationStore.getState().normalizedData?.expenseSummary.items ?? [];
    setLocalItems(items);
    setHasUnsavedChanges(false);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<ExpenseItem>) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch, amount: Math.max(0, patch.amount ?? item.amount) } : item)));
    setHasUnsavedChanges(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setLocalItems((prev) => prev.filter((item) => item.id !== id));
    setHasUnsavedChanges(true);
  }, []);

  const addItem = useCallback((label: string, amount: number) => {
    if (!label.trim()) return;
    setLocalItems((prev) => [
      ...prev,
      {
        id: `expense-${Date.now()}`,
        category: label,
        label,
        amount: Math.max(0, amount)
      }
    ]);
    setHasUnsavedChanges(true);
  }, []);

  const total = useMemo(() => localItems.reduce((sum, item) => sum + item.amount, 0), [localItems]);

  return {
    items: localItems,
    total,
    hasUnsavedChanges,
    updateItem,
    removeItem,
    addItem,
    syncFromStore
  };
}