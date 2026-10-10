import { createFileRoute } from "@tanstack/react-router";
import { extractPrescriptionFromBytes } from "@/lib/prescription/gemini.server";
import { fail, resolveMime, validateFile } from "@/lib/prescription/validation";
import type { ExtractionResult } from "@/lib/prescription/types";

/**
 * POST /api/public/extract-prescription
 * multipart/form-data with field "file" (JPG/JPEG/PNG/PDF, ≤10MB).
 * Files are processed in memory only and never stored or logged.
 */
function json(body: ExtractionResult, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const STATUS: Record<string, number> = {
  INVALID_FILE: 400, FILE_TOO_LARGE: 413, UNSUPPORTED_FORMAT: 415, UNREADABLE: 422,
  MALFORMED_RESPONSE: 502, RATE_LIMITED: 429, NETWORK_ERROR: 502, CONFIG_ERROR: 500, API_ERROR: 502,
};

export const Route = createFileRoute("/api/public/extract-prescription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return json(fail("CONFIG_ERROR", "Server is missing GEMINI_API_KEY."), 500);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json(fail("INVALID_FILE", "Request must be multipart/form-data with a 'file' field."), 400);
        }
        const file = form.get("file");
        if (!(file instanceof File)) return json(fail("INVALID_FILE", "No file was uploaded."), 400);

        const invalid = validateFile(file);
        if (invalid) return json(invalid, STATUS[invalid.error.code]);

        const result = await extractPrescriptionFromBytes({
          data: await file.arrayBuffer(),
          mimeType: resolveMime(file.name, file.type)!,
          apiKey,
          signal: request.signal,
        });
        return json(result, result.success ? 200 : STATUS[result.error.code] ?? 500);
      },
    },
  },
});
