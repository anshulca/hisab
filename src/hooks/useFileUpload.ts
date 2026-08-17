import { useCallback, useState } from 'react';
import { useComputationStore } from '../store/computationStore';

export interface ProcessResult {
  ok: boolean;
  message: string;
  elapsedMs: number;
}

export function useFileUpload() {
  const processRawText = useComputationStore((state) => state.processRawText);
  const setUpload = useComputationStore((state) => state.setUpload);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ProcessResult>({ ok: false, message: '', elapsedMs: 0 });

  const processFile = useCallback(
    async (file: File): Promise<ProcessResult> => {
      if (!file) {
        return { ok: false, message: 'No file selected.', elapsedMs: 0 };
      }

      if (!file.name.toLowerCase().endsWith('.json')) {
        setUpload({ status: 'error', error: 'Only .json files are supported (ITR export format).' });
        return { ok: false, message: 'Unsupported file type. Upload a .json file.', elapsedMs: 0 };
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setUpload({ status: 'error', error: 'File is larger than 5MB.' });
        return { ok: false, message: 'File too large (max 5MB).', elapsedMs: 0 };
      }

      setIsProcessing(true);
      setUpload({ status: 'processing', fileName: file.name, fileSize: file.size });
      setProgress(15);

      const start = Date.now();
      try {
        const text = await file.text();
        setProgress(60);

        await new Promise((r) => setTimeout(r, 350));
        setProgress(90);

        processRawText(text, file.name);
        setProgress(100);

        const elapsedMs = Date.now() - start;
        const result: ProcessResult = { ok: true, message: `Processed ${file.name} successfully.`, elapsedMs };
        setLastResult(result);
        return result;
      } catch (error) {
        const result: ProcessResult = {
          ok: false,
          message: error instanceof Error ? error.message : 'Failed to read the file.',
          elapsedMs: Date.now() - start
        };
        setLastResult(result);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [processRawText, setUpload]
  );

  return { isProcessing, progress, lastResult, processFile };
}