/**
 * Browser-side image preprocessing to improve OCR readability.
 * - Downscales very large photos (max 2400px long edge)
 * - Applies EXIF rotation, upscales small images
 * - Converts to grayscale, stretches contrast and sharpens text
 * Skew/perspective is handled by the vision model's prompt.
 * PDFs are passed through untouched.
 */
const MAX_EDGE = 2400;
const MIN_EDGE = 1600;

export async function preprocessImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof document === "undefined") return file;
  try {
    // imageOrientation honours EXIF rotation from phone cameras
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    // Upscale low-resolution images, downscale huge ones
    const scale = longEdge < MIN_EDGE ? MIN_EDGE / longEdge : Math.min(1, MAX_EDGE / longEdge);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
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
    sharpen(d, w, h);
    ctx.putImageData(img, 0, 0);

    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return file;
    const name = file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // fall back to original on any failure
  }
}

/** 3x3 unsharp kernel on a grayscale RGBA buffer (in place). */
function sharpen(d: Uint8ClampedArray, w: number, h: number) {
  const src = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = d[i * 4]!;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 5 * src[i]! - src[i - 1]! - src[i + 1]! - src[i - w]! - src[i + w]!;
      const c = v < 0 ? 0 : v > 255 ? 255 : v;
      const o = i * 4;
      d[o] = d[o + 1] = d[o + 2] = c;
    }
  }
}
