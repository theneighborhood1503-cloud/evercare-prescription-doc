import { useCallback, useEffect, useRef, useState } from "react";
import { extractPrescription } from "@/lib/prescription/client";
import type { ExtractionFailure, ExtractionSuccess } from "@/lib/prescription/types";
import { validateFile } from "@/lib/prescription/validation";

type Status = "idle" | "ready" | "loading" | "success" | "error";

/** UI-agnostic state machine around extractPrescription(). */
export function usePrescriptionExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ExtractionSuccess | null>(null);
  const [error, setError] = useState<ExtractionFailure["error"] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const select = useCallback((f: File) => {
    abortRef.current?.abort();
    setResult(null);
    const invalid = validateFile(f);
    if (invalid) {
      setFile(null);
      setPreviewUrl(null);
      setError(invalid.error);
      setStatus("error");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
    setStatus("ready");
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setError(null);
    const r = await extractPrescription(file, { signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    if (r.success) { setResult(r); setStatus("success"); }
    else { setError(r.error); setStatus("error"); }
  }, [file]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  return { file, previewUrl, status, result, error, select, run, reset };
}
