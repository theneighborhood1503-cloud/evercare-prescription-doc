/**
 * Browser-side image preprocessing to improve OCR readability.
 * - Downscales very large photos (max 2400px long edge)
 * - Converts to grayscale and applies mild contrast stretch
 * PDFs are passed through untouched.
 */
const MAX_EDGE = 2400;

export async function preprocessImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    if (range < 200) {
      for (let i = 0; i < d.length; i += 4) {
        const v = ((d[i]! - min) / range) * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);

    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return file;
    const name = file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // fall back to original on any failure
  }
}
