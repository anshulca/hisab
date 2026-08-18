import { create } from 'zustand';
import type { DepreciationAsset, FileUploadState, ITRForm, NormalizedITR, Taxpayer } from '../types';
import { parseItr4Object } from '../parser/itr4Parser';
import { parseItr1Object } from '../itr1/parser';
import { parseItr3Object } from '../itr3/parser';
import { detectITRForm } from '../itr/detectForm';

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

      const detected = detectITRForm(data);
      let parsed;
      let form: ITRForm;

      if (detected === 'ITR1') {
        parsed = parseItr1Object(data);
        form = 'ITR1';
      } else if (detected === 'ITR3') {
        parsed = parseItr3Object(data);
        form = 'ITR3';
      } else if (detected === 'ITR4') {
        parsed = parseItr4Object(data);
        form = 'ITR4';
      } else {
        // Detection failed — fall back by trying the parsers (each self-validates
        // and throws if the structure does not match its form).
        try {
          parsed = parseItr1Object(data);
          form = 'ITR1';
        } catch {
          try {
            parsed = parseItr3Object(data);
            form = 'ITR3';
          } catch {
            parsed = parseItr4Object(data);
            form = 'ITR4';
          }
        }
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
      const detected = detectITRForm(data);
      let normalized: NormalizedITR;
      if (detected === 'ITR1') normalized = parseItr1Object(data).normalized;
      else if (detected === 'ITR3') normalized = parseItr3Object(data).normalized;
      else {
        try {
          normalized = parseItr4Object(data).normalized;
        } catch {
          try {
            normalized = parseItr1Object(data).normalized;
          } catch {
            try {
              normalized = parseItr3Object(data).normalized;
            } catch {
              throw new Error('The previous year file could not be parsed as ITR-1, ITR-3 or ITR-4.');
            }
          }
        }
      }
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