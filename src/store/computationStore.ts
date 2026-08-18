import { create } from 'zustand';
import type { DepreciationAsset, FileUploadState, NormalizedITR, Taxpayer } from '../types';
import { parseItr4 } from '../parser/itr4Parser';

export interface ComputationStoreState {
  normalizedData: NormalizedITR | null;
  prevData: NormalizedITR | null;
  depreciationAssets: DepreciationAsset[];
  taxpayer: Taxpayer | null;
  upload: FileUploadState;
  isFinalized: boolean;
  setUpload: (upload: Partial<FileUploadState>) => void;
  processRawText: (rawText: string, fileName: string) => void;
  processPrevRawText: (rawText: string, fileName: string) => { ok: boolean; error?: string };
  updateDepreciation: (assets: DepreciationAsset[]) => void;
  finalize: () => void;
  reset: () => void;
}

const initialUpload: FileUploadState = {
  fileName: '',
  fileSize: 0,
  status: 'idle',
  issues: []
};

export const useComputationStore = create<ComputationStoreState>((set) => ({
  normalizedData: null,
  prevData: null,
  depreciationAssets: [],
  taxpayer: null,
  upload: initialUpload,
  isFinalized: false,

  setUpload: (upload) =>
    set((state) => ({ upload: { ...state.upload, ...upload } })),

  processRawText: (rawText, fileName) => {
    try {
      const { normalized, issues } = parseItr4(rawText);
      set({
        normalizedData: normalized,
        depreciationAssets: normalized.depreciation.assets,
        taxpayer: normalized.taxpayer,
        upload: {
          fileName,
          fileSize: new Blob([rawText]).size,
          status: 'ready',
          issues
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON file. Please upload a valid ITR export.';
      set({
        normalizedData: null,
        depreciationAssets: [],
        taxpayer: null,
        upload: {
          fileName,
          fileSize: new Blob([rawText]).size,
          status: 'error',
          issues: [],
          error: message
        }
      });
    }
  },

  processPrevRawText: (rawText, _fileName) => {
    try {
      const { normalized } = parseItr4(rawText);
      set({ prevData: normalized });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON file. Please upload a valid ITR export.';
      return { ok: false, error: message };
    }
  },

  updateDepreciation: (assets) =>
    set((state) => {
      if (!state.normalizedData) return {};
      const totalDepreciation = assets.reduce((sum, a) => sum + a.depreciation, 0);
      return {
        depreciationAssets: assets,
        normalizedData: {
          ...state.normalizedData,
          depreciation: { totalDepreciation, assets }
        }
      };
    }),

  finalize: () => set({ isFinalized: true }),

  reset: () =>
    set({
      normalizedData: null,
      prevData: null,
      depreciationAssets: [],
      taxpayer: null,
      upload: initialUpload,
      isFinalized: false
    })
}));