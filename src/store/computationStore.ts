import { create } from 'zustand';
import type { DepreciationAsset, FileUploadState, ITRForm, NormalizedITR, Taxpayer } from '../types';
import { parseAnyITRObject } from '../parser/parseAnyITR';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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
      let data: unknown;
      try {
        data = JSON.parse(stripBom(rawText).trim());
      } catch {
        throw new Error(
          'This file could not be read as JSON. Please upload the ITR export from the e-filing portal.'
        );
      }

      const parsed = parseAnyITRObject(data);
      set({
        normalizedData: parsed.normalized,
        depreciationAssets: parsed.normalized.depreciation.assets,
        taxpayer: parsed.normalized.taxpayer,
        itrForm: parsed.form,
        upload: {
          fileName,
          fileSize: new Blob([rawText]).size,
          status: 'ready',
          issues: parsed.issues
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON file. Please upload a valid ITR-1 / ITR-3 / ITR-4 export.';
      set({
        normalizedData: null,
        depreciationAssets: [],
        taxpayer: null,
        itrForm: 'UNKNOWN',
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
      let data: unknown;
      try {
        data = JSON.parse(stripBom(rawText).trim());
      } catch {
        return { ok: false, error: 'This file could not be read as JSON. Please upload a valid ITR export.' };
      }
      const parsed = parseAnyITRObject(data);
      set({ prevData: parsed.normalized });
      return { ok: true };
    } catch (_) {
      return {
        ok: false,
        error: 'The previous year file could not be parsed as ITR-1, ITR-3 or ITR-4. Please check the file and try again.'
      };
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