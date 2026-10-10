/**
 * EVERCARE Prescription Extractor — stable response contract (v1).
 * Pure types + zod schemas. No UI, no runtime-specific imports.
 */
import { z } from "zod";

export const ReviewStatus = z.enum(["confident", "needs_review", "unknown"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

const nullableStr = z.string().nullable();

export const MedicineSchema = z.object({
  medicine_name: z.string(),
  brand_name: nullableStr,
  generic_name: nullableStr,
  dosage: nullableStr,
  dosage_unit: nullableStr,
  quantity_per_dose: nullableStr,
  route_of_administration: nullableStr,
  frequency: nullableStr,
  prescribed_times: z.array(z.string()),
  duration: nullableStr,
  total_quantity: nullableStr,
  special_instructions: nullableStr,
  source_text: z.string(),
  confidence_or_review_status: ReviewStatus,
  missing_fields: z.array(z.string()),
});
export type Medicine = z.infer<typeof MedicineSchema>;

export const PrescriptionDetailsSchema = z.object({
  prescription_date: nullableStr,
  patient_name: nullableStr,
  prescriber_name: nullableStr,
  prescriber_details: nullableStr,
});
export type PrescriptionDetails = z.infer<typeof PrescriptionDetailsSchema>;

export const ExtractionSuccessSchema = z.object({
  success: z.literal(true),
  raw_text: z.string(),
  prescription: PrescriptionDetailsSchema,
  medicines: z.array(MedicineSchema),
  warnings: z.array(z.string()),
});
export type ExtractionSuccess = z.infer<typeof ExtractionSuccessSchema>;

export type ExtractionErrorCode =
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "UNREADABLE"
  | "MALFORMED_RESPONSE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "CONFIG_ERROR"
  | "API_ERROR";

export interface ExtractionFailure {
  success: false;
  error: { code: ExtractionErrorCode; message: string; retryable: boolean };
}

export type ExtractionResult = ExtractionSuccess | ExtractionFailure;

export const MEDICINE_FIELDS = [
  "medicine_name",
  "brand_name",
  "generic_name",
  "dosage",
  "dosage_unit",
  "quantity_per_dose",
  "route_of_administration",
  "frequency",
  "prescribed_times",
  "duration",
  "total_quantity",
  "special_instructions",
] as const;

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
