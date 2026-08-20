import { useCallback } from 'react';
import { useUsageStore, isDownloadAllowed, freeReportsRemaining } from '../access/usageStore';

/**
 * Wraps a PDF download action with the free-tier access guard. When the free
 * limit is reached and the device is not admin-unlocked, the action is skipped
 * and the unlock modal is opened instead.
 */
export function useGuardedDownload(action: () => Promise<void> | void): () => Promise<void> {
  const openLimitModal = useUsageStore((s) => s.openLimitModal);

  return useCallback(async () => {
    if (isDownloadAllowed()) {
      await action();
    } else {
      openLimitModal();
    }
  }, [action, openLimitModal]);
}

/** Live free-tier status for UI display. */
export function useFreeStatus() {
  const pdfDownloads = useUsageStore((s) => s.pdfDownloads);
  const adminUnlocked = useUsageStore((s) => s.adminUnlocked);
  return {
    used: pdfDownloads,
    remaining: freeReportsRemaining(),
    limit: 3,
    isAdmin: adminUnlocked
  };
}