/**
 * Server-only Gemini pipeline. Portable: uses only `fetch` + `zod`.
 * Step 1 (OCR): transcribe ALL readable text from the image/PDF verbatim.
 * Step 2 (Parse): extract medicines ONLY from the step-1 text, with strict JSON schema.
 * Never logs prescription content.
 */
import {
  ExtractionSuccessSchema,
  MEDICINE_FIELDS,
  MedicineSchema,
  PrescriptionDetailsSchema,
  type ExtractionResult,
  type Medicine,
} from "./types";
import { fail } from "./validation";
import { z } from "zod";

export const GEMINI_MODEL = "gemini-2.5-flash";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callGemini(apiKey: string, body: unknown, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API}/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch {
    throw new GeminiError(0, "network");
  }
  if (!res.ok) {
    let msg = `Gemini API error (${res.status})`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* ignore */
    }
    throw new GeminiError(res.status, msg);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) throw new GeminiError(422, "The request was blocked by the model.");
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const OCR_PROMPT = `You are an OCR engine for medical prescriptions.
Transcribe ALL readable text from this document exactly as written, preserving line breaks and reading order.
Rules:
- Do NOT correct, expand, translate, or interpret anything.
- Do NOT guess illegible words. Write [illegible] for any word you cannot read with confidence.
- Include headers, addresses, doctor details, dates, notes, everything.
Return JSON: {"raw_text": string, "readable": boolean, "quality_notes": string[]}.
Set readable=false if the image is not a prescription/document or no text can be read.`;

const OCR_SCHEMA = {
  type: "OBJECT",
  properties: {
    raw_text: { type: "STRING" },
    readable: { type: "BOOLEAN" },
    quality_notes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["raw_text", "readable", "quality_notes"],
};

const nStr = { type: "STRING", nullable: true };
const PARSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    prescription: {
      type: "OBJECT",
      properties: {
        prescription_date: nStr,
        patient_name: nStr,
        prescriber_name: nStr,
        prescriber_details: nStr,
      },
      required: ["prescription_date", "patient_name", "prescriber_name", "prescriber_details"],
    },
    medicines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          medicine_name: { type: "STRING" },
          brand_name: nStr,
          generic_name: nStr,
          dosage: nStr,
          dosage_unit: nStr,
          quantity_per_dose: nStr,
          route_of_administration: nStr,
          frequency: nStr,
          prescribed_times: { type: "ARRAY", items: { type: "STRING" } },
          duration: nStr,
          total_quantity: nStr,
          special_instructions: nStr,
          source_text: { type: "STRING" },
          confidence_or_review_status: { type: "STRING", enum: ["confident", "needs_review", "unknown"] },
          missing_fields: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "medicine_name", "brand_name", "generic_name", "dosage", "dosage_unit", "quantity_per_dose",
          "route_of_administration", "frequency", "prescribed_times", "duration", "total_quantity",
          "special_instructions", "source_text", "confidence_or_review_status", "missing_fields",
        ],
      },
    },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["prescription", "medicines", "warnings"],
};

const PARSE_PROMPT = (raw: string) => `You extract medicine information from OCR text of a medical prescription.
Use ONLY the text below. Never invent, infer, or complete missing values.

Rules:
- Only list actual medicines. Ignore headings, clinic addresses, doctor credentials, diagnoses, test results, vitals and general advice.
- One entry per medicine, in order of appearance.
- source_text: copy the exact line(s) for that medicine from the OCR text.
- Preserve original wording (e.g. "1-0-1", "BD", "after food", "x 5 days").
- Keep these DISTINCT:
  dosage = strength of the medicine (e.g. "500"), dosage_unit = its unit (mg, mcg, ml, drops, IU, %),
  quantity_per_dose = how much per intake (e.g. "1 tablet", "5 ml"),
  frequency = how often as written (e.g. "BD", "1-0-1", "twice daily"),
  duration = how long (e.g. "5 days"),
  total_quantity = total amount to dispense (e.g. "10 tabs", "1 bottle").
- prescribed_times: only explicitly written times/meal times (e.g. "8 AM", "morning", "bedtime"). Do NOT derive times from codes like BD or 1-0-1. Empty array if none.
- generic_name only if explicitly written; brand_name only if a brand is clearly written.
- route_of_administration only if stated or unambiguous from the written form (e.g. "eye drops", "inj", "tab" -> oral is NOT allowed unless written; leave null).
- Use null for anything absent. List every null field name (from: ${MEDICINE_FIELDS.join(", ")}) in missing_fields.
- confidence_or_review_status: "confident" only if name and its written instructions are fully legible; "needs_review" if any part is ambiguous, contains [illegible], or is abbreviated unclearly; "unknown" if you are unsure it is a medicine at all.
- prescription-level fields: only if present, else null.
- warnings: short notes about ambiguity, illegible parts, or possibly missed items. No patient data in warnings.

OCR TEXT:
"""
${raw}
"""`;

const ParseSchema = z.object({
  prescription: PrescriptionDetailsSchema,
  medicines: z.array(MedicineSchema),
  warnings: z.array(z.string()),
});

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
    return null;
  }
}

/** Ensure missing_fields reflects actual nulls and flag medicines whose source isn't in the OCR text. */
function normalizeMedicine(m: Medicine, raw: string, warnings: string[]): Medicine {
  const missing = new Set(m.missing_fields.filter((f) => (MEDICINE_FIELDS as readonly string[]).includes(f)));
  for (const f of MEDICINE_FIELDS) {
    const v = m[f as keyof Medicine];
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) missing.add(f);
    else missing.delete(f);
  }
  let status = m.confidence_or_review_status;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const firstWord = norm(m.medicine_name).split(" ")[0] ?? "";
  if (firstWord && !norm(raw).includes(firstWord)) {
    status = "needs_review";
    warnings.push(`"${m.medicine_name}" could not be matched exactly in the extracted text — please verify.`);
  }
  if (/\[illegible\]/i.test(m.source_text) && status === "confident") status = "needs_review";
  return { ...m, missing_fields: [...missing], confidence_or_review_status: status };
}

export interface ExtractInput {
  data: ArrayBuffer;
  mimeType: string;
  apiKey: string;
  signal?: AbortSignal;
}

/**
 * Core extraction. Accepts file bytes + MIME and returns the stable ExtractionResult contract.
 */
export async function extractPrescriptionFromBytes({ data, mimeType, apiKey, signal }: ExtractInput): Promise<ExtractionResult> {
  try {
    // ---- Step 1: OCR ----
    const ocrText = await callGemini(
      apiKey,
      {
        contents: [
          { role: "user", parts: [{ inline_data: { mime_type: mimeType, data: toBase64(data) } }, { text: OCR_PROMPT }] },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: OCR_SCHEMA },
      },
      signal,
    );
    const ocr = z
      .object({ raw_text: z.string(), readable: z.boolean(), quality_notes: z.array(z.string()).default([]) })
      .safeParse(safeJson(ocrText));
    if (!ocr.success) return fail("MALFORMED_RESPONSE", "The text reader returned an unexpected response. Please try again.", true);

    const raw = ocr.data.raw_text.trim();
    if (!ocr.data.readable || raw.length < 3) {
      return fail("UNREADABLE", "No readable prescription text was found. Try a clearer, well-lit photo with the full prescription in frame.");
    }

    // ---- Step 2: Parse medicines from text only ----
    const parsedText = await callGemini(
      apiKey,
      {
        contents: [{ role: "user", parts: [{ text: PARSE_PROMPT(raw) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: PARSE_SCHEMA },
      },
      signal,
    );
    const parsed = ParseSchema.safeParse(safeJson(parsedText));
    if (!parsed.success) return fail("MALFORMED_RESPONSE", "The medicine parser returned invalid data. Please try again.", true);

    const warnings = [...ocr.data.quality_notes, ...parsed.data.warnings];
    if (/\[illegible\]/i.test(raw)) warnings.push("Some words were illegible and marked [illegible].");
    const medicines = parsed.data.medicines.map((m) => normalizeMedicine(m, raw, warnings));
    if (medicines.length === 0) warnings.push("No medicines were detected in the readable text.");

    const result = { success: true as const, raw_text: raw, prescription: parsed.data.prescription, medicines, warnings };
    const check = ExtractionSuccessSchema.safeParse(result);
    if (!check.success) return fail("MALFORMED_RESPONSE", "Extraction output failed validation.", true);
    return check.data;
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.status === 0) return fail("NETWORK_ERROR", "Could not reach the Gemini service. Check your connection and retry.", true);
      if (e.status === 429) return fail("RATE_LIMITED", "Too many requests right now. Please wait a moment and retry.", true);
      if (e.status === 401 || e.status === 403) return fail("CONFIG_ERROR", "The Gemini API key is invalid or lacks permission.");
      if (e.status === 400) return fail("API_ERROR", "The file could not be processed by Gemini. Try a different image or PDF.");
      if (e.status >= 500) return fail("API_ERROR", "Gemini is temporarily unavailable. Please retry shortly.", true);
      return fail("API_ERROR", "Gemini could not process this prescription.", true);
    }
    return fail("API_ERROR", "Unexpected error during extraction.", true);
  }
}
