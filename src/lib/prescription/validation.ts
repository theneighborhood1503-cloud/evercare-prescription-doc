import { ACCEPTED_MIME, MAX_FILE_BYTES, type ExtractionFailure } from "./types";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

/** Resolve a reliable MIME type from file type or extension. */
export function resolveMime(name: string, type: string): string | null {
  if ((ACCEPTED_MIME as readonly string[]).includes(type)) return type;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

/** Validate a prescription file. Returns a failure object or null when valid. */
export function validateFile(file: { name: string; type: string; size: number }): ExtractionFailure | null {
  if (!file || file.size === 0) {
    return fail("INVALID_FILE", "The file is empty or could not be read.");
  }
  if (!resolveMime(file.name, file.type)) {
    return fail("UNSUPPORTED_FORMAT", "Unsupported format. Please use JPG, JPEG, PNG or PDF.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("FILE_TOO_LARGE", `File is too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  return null;
}

export function fail(
  code: ExtractionFailure["error"]["code"],
  message: string,
  retryable = false,
): ExtractionFailure {
  return { success: false, error: { code, message, retryable } };
}
