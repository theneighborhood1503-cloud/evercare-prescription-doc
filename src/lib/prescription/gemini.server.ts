/**
 * Server-only Gemini pipeline (via Lovable AI Gateway). Portable: uses only `fetch` + `zod`.
 * To use Google directly later, swap callGemini() for a generativelanguage.googleapis.com call.
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

/** Gemini model served through the Lovable AI Gateway (OpenAI-compatible chat completions). */
export const GEMINI_MODEL = "google/gemini-3.5-flash";
export const DEFAULT_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type GPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GSchema = { type: string; nullable?: boolean; properties?: Record<string, GSchema>; items?: GSchema; required?: string[]; enum?: string[] };

/** Convert the Gemini-style schema to strict JSON Schema. */
function toJsonSchema(g: GSchema): Record<string, unknown> {
  const t = g.type.toLowerCase();
  const out: Record<string, unknown> = { type: g.nullable ? [t, "null"] : t };
  if (g.enum) out["enum"] = g.enum;
  if (g.items) out["items"] = toJsonSchema(g.items);
  if (g.properties) {
    out["properties"] = Object.fromEntries(Object.entries(g.properties).map(([k, v]) => [k, toJsonSchema(v)]));
    out["required"] = g.required ?? Object.keys(g.properties);
    out["additionalProperties"] = false;
  }
  return out;
}

function toChatPart(p: GPart) {
  if ("text" in p) return { type: "text", text: p.text };
  const { mime_type, data } = p.inline_data;
  if (mime_type === "application/pdf") {
    return { type: "file", file: { filename: "prescription.pdf", file_data: `data:application/pdf;base64,${data}` } };
  }
  return { type: "image_url", image_url: { url: `data:${mime_type};base64,${data}` } };
}

/** Streams a chat completion and returns the accumulated text. */
async function callGemini(
  apiKey: string,
  body: { contents: { parts: GPart[] }[]; generationConfig: { responseSchema: GSchema; [k: string]: unknown } },
  signal?: AbortSignal,
  gatewayUrl = DEFAULT_GATEWAY_URL,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        stream: true,
        temperature: 0,
        messages: [{ role: "user", content: body.contents.flatMap((c) => c.parts.map(toChatPart)) }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", strict: true, schema: toJsonSchema(body.generationConfig.responseSchema) },
        },
      }),
      signal: signal ?? null,
    });
  } catch {
    throw new GeminiError(0, "network");
  }
  if (!res.ok || !res.body) {
    let msg = `AI error (${res.status})`;
    try {
      const j = (await res.json()) as { error?: { message?: string }; message?: string };
      msg = j.error?.message ?? j.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new GeminiError(res.status, msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string; code?: number } };
        if (j.error) throw new GeminiError(j.error.code ?? 502, j.error.message ?? "stream error");
        text += j.choices?.[0]?.delta?.content ?? "";
      } catch (e) {
        if (e instanceof GeminiError) throw e;
      }
    }
  }
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
- The page may be rotated, skewed or photographed at an angle; read it in its natural orientation.
- Partial transcription is fine: transcribe whatever is readable even if most of the page is unclear.
Return JSON: {"raw_text": string, "readable": boolean, "quality_notes": string[]}.
Set readable=false only if the image contains no readable text at all.`;

const OCR_SCHEMA: GSchema = {
  type: "OBJECT",
  properties: {
    raw_text: { type: "STRING" },
    readable: { type: "BOOLEAN" },
    quality_notes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["raw_text", "readable", "quality_notes"],
};

const nStr: GSchema = { type: "STRING", nullable: true };
const PARSE_SCHEMA: GSchema = {
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

const VISION_PROMPT = (raw: string) => `${PARSE_PROMPT(raw || "(OCR returned little or no text)")}

ADDITIONAL CONTEXT: The OCR text above may be incomplete (e.g. handwriting). The original prescription image is attached.
Look at the image directly to read medicine lines the OCR missed. The same rules apply: never guess.
- If a medicine line clearly exists but its name is unreadable, use medicine_name "Name unclear", status "needs_review", and fill only the parts you can actually read.
- source_text: copy what you can read from that line in the image, marking unreadable words as [illegible].`;

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
function normalizeMedicine(m: Medicine, raw: string, warnings: string[], fromImage = false): Medicine {
  const missing = new Set(m.missing_fields.filter((f) => (MEDICINE_FIELDS as readonly string[]).includes(f)));
  for (const f of MEDICINE_FIELDS) {
    const v = m[f as keyof Medicine];
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) missing.add(f);
    else missing.delete(f);
  }
  let status = m.confidence_or_review_status;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const firstWord = norm(m.medicine_name).split(" ")[0] ?? "";
  if (firstWord && firstWord !== "name" && !norm(raw).includes(firstWord)) {
    status = "needs_review";
    if (!fromImage) warnings.push(`"${m.medicine_name}" could not be matched exactly in the extracted text — please verify.`);
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
          { parts: [{ inline_data: { mime_type: mimeType, data: toBase64(data) } }, { text: OCR_PROMPT }] },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: OCR_SCHEMA },
      },
      signal,
    );
    const ocr = z
      .object({ raw_text: z.string(), readable: z.boolean(), quality_notes: z.array(z.string()).default([]) })
      .safeParse(safeJson(ocrText));
    const raw = ocr.success ? ocr.data.raw_text.trim() : "";
    const qualityNotes = ocr.success ? ocr.data.quality_notes : ["Text transcription was incomplete; medicines were read directly from the image."];

    const parseCall = async (parts: unknown[]) =>
      ParseSchema.safeParse(
        safeJson(
          await callGemini(
            apiKey,
            {
              contents: [{ parts: parts as GPart[] }],
              generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: PARSE_SCHEMA },
            },
            signal,
          ),
        ),
      );

    // ---- Step 2: parse from OCR text AND directly from the image, in parallel ----
    // Running both at once keeps total wait close to a single pass while the
    // vision pass still rescues handwriting and weak OCR. The better result wins.
    const illegibleCount = (raw.match(/\[illegible\]/gi) ?? []).length;
    const [textParsed, visionParsed] = await Promise.all([
      raw.length >= 3 ? parseCall([{ text: PARSE_PROMPT(raw) }]) : Promise.resolve(null),
      parseCall([{ inline_data: { mime_type: mimeType, data: toBase64(data) } }, { text: VISION_PROMPT(raw) }]),
    ]);

    // Prefer the text-based parse (less guessy); use vision when it is clearly better.
    let parsed = textParsed;
    let usedVision = false;
    const textWeak =
      !textParsed?.success ||
      textParsed.data.medicines.length === 0 ||
      illegibleCount >= 3 ||
      textParsed.data.medicines.some((m) => m.confidence_or_review_status !== "confident");
    if (
      visionParsed.success &&
      (!textParsed?.success ||
        (textWeak && visionParsed.data.medicines.length >= (textParsed?.data.medicines.length ?? 0)))
    ) {
      parsed = visionParsed;
      usedVision = true;
    }

    if (!parsed?.success) {
      if (raw.length < 3) {
        return fail("UNREADABLE", "Very little text could be read. Please upload a clearer, well-lit image, or crop it to just the prescription.");
      }
      return fail("MALFORMED_RESPONSE", "The medicine parser returned invalid data. Please try again.", true);
    }

    const warnings = [...qualityNotes, ...parsed.data.warnings];
    if (usedVision) warnings.push("Some details were read directly from the image because the text was unclear — please verify carefully.");
    if (raw.length < 3 && parsed.data.medicines.length === 0) {
      return fail("UNREADABLE", "No readable text or medicines were found. Please upload a clearer image, or crop it to just the prescription.");
    }
    if (/\[illegible\]/i.test(raw)) warnings.push("Some words were illegible and marked [illegible].");
    const medicines = parsed.data.medicines.map((m) => normalizeMedicine(m, raw, warnings, usedVision));
    if (medicines.length === 0) warnings.push("No medicines were detected in the readable text.");

    const result = { success: true as const, raw_text: raw || "(No text could be transcribed — medicines were read directly from the image.)", prescription: parsed.data.prescription, medicines, warnings };
    const check = ExtractionSuccessSchema.safeParse(result);
    if (!check.success) return fail("MALFORMED_RESPONSE", "Extraction output failed validation.", true);
    return check.data;
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.status === 0) return fail("NETWORK_ERROR", "Could not reach the Gemini service. Check your connection and retry.", true);
      if (e.status === 429) return fail("RATE_LIMITED", "Too many requests right now. Please wait a moment and retry.", true);
      if (e.status === 402) return fail("API_ERROR", "AI credits have run out. Add credits in workspace settings, then retry.");
      if (e.status === 401) return fail("CONFIG_ERROR", "The AI service key is missing or invalid.");
      if (e.status === 403) return fail("API_ERROR", "The AI service declined this request.");
      if (e.status === 400) return fail("API_ERROR", "The file could not be processed by Gemini. Try a different image or PDF.");
      if (e.status >= 500) return fail("API_ERROR", "Gemini is temporarily unavailable. Please retry shortly.", true);
      return fail("API_ERROR", "Gemini could not process this prescription.", true);
    }
    return fail("API_ERROR", "Unexpected error during extraction.", true);
  }
}
