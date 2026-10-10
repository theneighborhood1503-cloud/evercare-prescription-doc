# EVERCARE Prescription Extractor — Integration Guide

## Architecture

| Layer | File | Notes |
|---|---|---|
| Types / contract (zod) | `src/lib/prescription/types.ts` | Portable, no runtime deps beyond `zod` |
| Validation | `src/lib/prescription/validation.ts` | File type/size checks, shared client + server |
| Image preprocessing | `src/lib/prescription/preprocess.ts` | Browser only: downscale, grayscale, contrast |
| OCR + Gemini parsing | `src/lib/prescription/gemini.server.ts` | Server only. Plain `fetch` (streaming) to an OpenAI-compatible chat endpoint serving Gemini |
| HTTP endpoint | `src/routes/api/public/extract-prescription.ts` | Thin wrapper; reads `GEMINI_API_KEY` |
| API client | `src/lib/prescription/client.ts` | `extractPrescription(file)` |
| State hook | `src/hooks/use-prescription-extractor.ts` | UI-agnostic state machine |
| UI | `src/routes/index.tsx`, `src/components/prescription/*` | Presentation only |

Pipeline: validate → preprocess (EXIF rotation, upscale small images, grayscale, contrast, sharpen) → **Gemini OCR pass** (verbatim transcription, `[illegible]` markers) → **Gemini parse pass** over the text only (strict `responseSchema`) → **vision fallback** (if text is weak/handwritten, Gemini reads the image directly; unreadable names become "Name unclear") → zod validation → normalization (recomputes `missing_fields`, flags names not found in the text) → response.

Model: `google/gemini-3.5-flash` via Lovable AI Gateway (change `GEMINI_MODEL` / `DEFAULT_GATEWAY_URL` in `gemini.server.ts`). Partial results are returned whenever any medicine is readable; empty fields display as "Not clearly mentioned".

## Environment variables

| Name | Where | Description |
|---|---|---|
| `LOVABLE_API_KEY` | server only | Provided automatically in Lovable. |

Never prefix keys with `VITE_`; they must never reach the browser.

**Moving to EVERCARE without Lovable:** replace the body of `callGemini()` with a call to Google's API
(`POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, `Authorization: Bearer $GEMINI_API_KEY`, model `gemini-2.5-flash`) — it accepts the same OpenAI-compatible request, so only the URL, key and model id change. Pass that key in the route instead of `LOVABLE_API_KEY`.

## Local install & run

```bash
bun install            # or npm install
export LOVABLE_API_KEY=your_key   # or GEMINI_API_KEY after the swap above   # or put in .env (do not commit)
bun run dev            # http://localhost:8080
```

## API

`POST /api/public/extract-prescription` — `multipart/form-data`, field `file` (JPG/JPEG/PNG/PDF, ≤ 10 MB).

```bash
curl -F "file=@rx.jpg" http://localhost:8080/api/public/extract-prescription
```

### Success (200)

```json
{
  "success": true,
  "raw_text": "…full transcription…",
  "prescription": { "prescription_date": null, "patient_name": null, "prescriber_name": null, "prescriber_details": null },
  "medicines": [{
    "medicine_name": "…", "brand_name": null, "generic_name": null,
    "dosage": "…", "dosage_unit": "mg", "quantity_per_dose": "1 tablet",
    "route_of_administration": null, "frequency": "1-0-1", "prescribed_times": [],
    "duration": "5 days", "total_quantity": null, "special_instructions": "after food",
    "source_text": "exact line from raw_text",
    "confidence_or_review_status": "confident | needs_review | unknown",
    "missing_fields": ["brand_name", "generic_name", "route_of_administration", "prescribed_times", "total_quantity"]
  }],
  "warnings": []
}
```

### Failure

```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "…", "retryable": true } }
```

| code | HTTP | retryable |
|---|---|---|
| INVALID_FILE | 400 | no |
| UNSUPPORTED_FORMAT | 415 | no |
| FILE_TOO_LARGE | 413 | no |
| UNREADABLE | 422 | no (retake photo) |
| RATE_LIMITED | 429 | yes (wait) |
| MALFORMED_RESPONSE / NETWORK_ERROR / API_ERROR | 502 | usually |
| CONFIG_ERROR | 500 | no (fix key) |

## Integrating into EVERCARE (React)

1. Copy `src/lib/prescription/` and (optionally) `src/hooks/use-prescription-extractor.ts` and `src/components/prescription/`.
2. Install `zod` (and `lucide-react` + shadcn `button`, `badge`, `dialog`, `sonner` if reusing the UI).
3. Server: expose `extractPrescriptionFromBytes` from any backend:
   - **TanStack Start**: copy the route file as-is.
   - **Express/Node 18+**:
     ```ts
     app.post("/api/extract-prescription", upload.single("file"), async (req, res) => {
       const r = await extractPrescriptionFromBytes({ data: req.file.buffer.buffer.slice(req.file.buffer.byteOffset, req.file.buffer.byteOffset + req.file.buffer.byteLength), mimeType: req.file.mimetype, apiKey: process.env.GEMINI_API_KEY! /* see swap note */ });
       res.status(r.success ? 200 : 422).json(r);
     });
     ```
     (use `multer` memory storage so files are never written to disk).
   - **Cloudflare Worker / Deno / Next.js route handler**: call it with `await file.arrayBuffer()` from `request.formData()`.
4. Client:
   ```ts
   import { extractPrescription } from "@/lib/prescription/client";
   const result = await extractPrescription(file, { endpoint: "/api/extract-prescription" });
   if (result.success) save(result.medicines); else show(result.error.message);
   ```
5. Treat `needs_review` / `unknown` items as requiring user confirmation before creating any reminder.

## Privacy

Files are held in memory for the request only, never stored, never logged. The server logs no prescription text or patient data. The browser revokes preview object URLs on reset. Note: Google's Gemini API terms govern data handling on their side — use a paid-tier key for no-training guarantees.

## Test cases

| Case | Expected |
|---|---|
| Printed, single medicine (clear) | 1 medicine, `confident`, raw text complete |
| Printed, 4–6 medicines | Each listed separately, in order, with distinct `source_text` |
| Handwritten (legible) | Medicines found; abbreviations preserved (`BD`, `1-0-1`); often `needs_review` |
| Handwritten (poor) | `[illegible]` in raw text, affected items `needs_review`, warnings present |
| Blurry/dark photo | `UNREADABLE` error or warnings about quality |
| Incomplete (no duration) | `duration: null`, listed in `missing_fields`, no invented value |
| Non-prescription image (e.g. a cat) | `UNREADABLE` |
| PDF prescription | Same as image |
| 15 MB file / .docx | `FILE_TOO_LARGE` / `UNSUPPORTED_FORMAT` (client side, no request) |
| Header with clinic address + diagnosis | Not listed as medicines |

## Known OCR limitations

- Cursive or heavily abbreviated handwriting may be misread; always review.
- Very similar drug names (e.g. look-alike brands) can be confused — `source_text` is shown for verification.
- Glare, shadows, folds, and cropped edges reduce accuracy.
- Multi-page PDFs are supported but long PDFs take longer; images > 2400 px are downscaled.
- Non-English and mixed-script prescriptions work but with lower reliability.
- `route_of_administration` and `prescribed_times` are intentionally left null unless explicitly written.
