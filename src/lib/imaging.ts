/** Client-side image helpers: downscaling, JPEG encoding and perceptual hashing. */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

/** Downscale an image (data URL or object URL) to a JPEG data URL. */
export async function downscaleToJpeg(src: string, maxSize: number, quality = 0.72): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available on this device");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * 64-bit difference hash. Two visually near-identical photos produce hashes
 * that differ in only a handful of bits.
 */
export async function perceptualHash(src: string): Promise<string> {
  const img = await loadImage(src);
  const W = 9;
  const H = 8;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available on this device");
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const gray: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  let bits = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      bits += (gray[y * W + x] ?? 0) > (gray[y * W + x + 1] ?? 0) ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i] ?? "0", 16) ^ parseInt(b[i] ?? "0", 16);
    dist += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return dist;
}

/** Threshold below which two selfies are treated as the same picture. */
export const DUPLICATE_THRESHOLD = 8;
