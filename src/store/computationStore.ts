import { create } from 'zustand';
import type { DepreciationAsset, FileUploadState, ITRForm, NormalizedITR, Taxpayer } from '../types';
import { parseItr4 } from '../parser/itr4Parser';
import { parseItr1 } from '../itr1/parser';
import { detectITRForm } from '../itr/detectForm';

export interface ComputationStoreState {
  normalizedData: NormalizedITR | null;
  prevData: NormalizedITR | null;
  depreciationAssets: DepreciationAsset[];
  taxpayer: Taxpayer | null;
  upload: FileUploadState;
  itrForm: ITRForm;
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
  itrForm: 'UNKNOWN',
  isFinalized: false,

  setUpload: (upload) =>
    set((state) => ({ upload: { ...state.upload, ...upload } })),

  processRawText: (rawText, fileName) => {
    try {
      let parsed;
      let form: ITRForm;
      try {
        form = detectITRForm(JSON.parse(rawText));
      } catch {
        form = 'UNKNOWN';
      }
      if (form === 'ITR3') {
        throw new Error('ITR-3 detected. ITR-3 support is coming soon — please upload an ITR-1 or ITR-4 export.');
      }
      if (form === 'ITR1') {
        parsed = parseItr1(rawText);
      } else {
        // Real nested ITR-4 AND the legacy raw taxpayer-shaped fixtures both flow
        // through parseItr4 which self-detects them.
        parsed = parseItr4(rawText);
      }
      set({
        normalizedData: parsed.normalized,
        depreciationAssets: parsed.normalized.depreciation.assets,
        taxpayer: parsed.normalized.taxpayer,
        itrForm: form,
        upload: {
          fileName,
          fileSize: new Blob([rawText]).size,
          status: 'ready',
          issues: parsed.issues
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON file. Please upload a valid ITR-1 / ITR-4 export.';
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
      itrForm: 'UNKNOWN',
      isFinalized: false
    })
}));