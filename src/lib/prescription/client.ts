/**
 * Public client API: extractPrescription(file)
 * Validates, preprocesses images, posts to the server endpoint, and validates the response.
 */
import { preprocessImage } from "./preprocess";
import { ExtractionSuccessSchema, type ExtractionResult } from "./types";
import { fail, validateFile } from "./validation";

export interface ExtractOptions {
  endpoint?: string;
  signal?: AbortSignal;
  preprocess?: boolean;
}

export async function extractPrescription(file: File, opts: ExtractOptions = {}): Promise<ExtractionResult> {
  const invalid = validateFile(file);
  if (invalid) return invalid;

  const toSend = opts.preprocess === false ? file : await preprocessImage(file);
  const body = new FormData();
  body.append("file", toSend, toSend.name);

  let res: Response;
  try {
    res = await fetch(opts.endpoint ?? "/api/public/extract-prescription", { method: "POST", body, signal: opts.signal ?? null });
  } catch {
    return fail("NETWORK_ERROR", "Network error — could not reach the extraction server.", true);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return fail("MALFORMED_RESPONSE", `Server returned an invalid response (${res.status}).`, true);
  }

  const ok = ExtractionSuccessSchema.safeParse(data);
  if (ok.success) return ok.data;
  const err = data as { success?: boolean; error?: { code?: string; message?: string; retryable?: boolean } };
  if (err?.success === false && err.error?.message) {
    return { success: false, error: { code: (err.error.code as never) ?? "API_ERROR", message: err.error.message, retryable: !!err.error.retryable } };
  }
  return fail("MALFORMED_RESPONSE", "The server response did not match the expected format.", true);
}

export * from "./types";
