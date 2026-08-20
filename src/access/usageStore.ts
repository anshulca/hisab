import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sha256Hex } from '../utils/sha256';

/** Free reports allowed per device before admin unlock is required. */
export const FREE_REPORT_LIMIT = 3;

/**
 * Admin token hash (SHA-256 hex of the secret query-token). The token itself is
 * never stored client-side; only its digest is compared. Open the app as
 * `/?admin=TOKEN` to unlock admin mode for this device.
 */
const ADMIN_TOKEN_HASH = 'B1E3331B3DC607BEEFE33B06B283EE6B19F6E3847FF7C316C448B6F7827095B1';

export interface UsageStoreState {
  pdfDownloads: number;
  adminUnlocked: boolean;
  limitModalOpen: boolean;
  recordDownload: () => void;
  unlockAdmin: () => void;
  openLimitModal: () => void;
  closeLimitModal: () => void;
}

export const useUsageStore = create<UsageStoreState>()(
  persist(
    (set) => ({
      pdfDownloads: 0,
      adminUnlocked: false,
      limitModalOpen: false,

      recordDownload: () =>
        set((s) => ({ pdfDownloads: s.pdfDownloads + 1 })),

      unlockAdmin: () => set({ adminUnlocked: true }),

      openLimitModal: () => set({ limitModalOpen: true }),

      closeLimitModal: () => set({ limitModalOpen: false })
    }),
    {
      name: 'hisab-usage-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ pdfDownloads: s.pdfDownloads, adminUnlocked: s.adminUnlocked })
    }
  )
);

/** True when the device has admin access (unlimited reports). */
export function isAdminActive(): boolean {
  return useUsageStore.getState().adminUnlocked;
}

/** True when another free download is allowed. */
export function isDownloadAllowed(): boolean {
  const s = useUsageStore.getState();
  return s.adminUnlocked || s.pdfDownloads < FREE_REPORT_LIMIT;
}

/** Number of free reports remaining (0 when locked). */
export function freeReportsRemaining(): number {
  const s = useUsageStore.getState();
  if (s.adminUnlocked) return Infinity;
  return Math.max(0, FREE_REPORT_LIMIT - s.pdfDownloads);
}

/**
 * Detect the `?admin=TOKEN` query parameter and unlock admin mode when the
 * provided token matches the expected digest. Called once at app startup.
 */
export async function tryUnlockAdminFromUrl(login = window.location.href): Promise<boolean> {
  if (useUsageStore.getState().adminUnlocked) return true;
  const url = new URL(login);
  const raw = url.searchParams.get('admin');
  if (!raw) return false;
  try {
    const digest = await sha256Hex(new TextEncoder().encode(raw.trim()));
    if (digest === ADMIN_TOKEN_HASH) {
      useUsageStore.getState().unlockAdmin();
      return true;
    }
  } catch {
    /* hash unavailable — keep locked */
  }
  return false;
}

/** Raw query token check used only by tests/dev to avoid interacting with DOM. */
export function adminTokenHashOf(token: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(token.trim()));
}