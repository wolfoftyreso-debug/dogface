import { ERROR_MESSAGES } from "./types.ts";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 1600;
const MAX_OUTPUT_BYTES = 2_000_000;
const MIN_EDGE = 96;
const JPEG_QUALITY = 0.84;

export class PhotoError extends Error {
  readonly code: "unsupported" | "too_large" | "corrupt";
  constructor(code: "unsupported" | "too_large" | "corrupt", message: string) {
    super(message);
    this.code = code;
    this.name = "PhotoError";
  }
}

const ALLOWED_TYPE = /^image\/(jpeg|jpg|pjpeg|png|webp|gif|bmp|heic|heif)$/i;

/** Concrete types only — `image/*` makes iPhone offer “Välj fil”. */
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,image/webp,.jpg,.jpeg,.png,.heic,.heif,.webp";

export function isAllowedPhotoType(type: string): boolean {
  if (!type) return true;
  return ALLOWED_TYPE.test(type) || type === "image/*";
}

async function bitmapFromFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(file);
  }
}

async function bitmapFromImageElement(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new PhotoError("corrupt", ERROR_MESSAGES.corrupt));
      img.src = url;
    });
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new PhotoError("corrupt", ERROR_MESSAGES.corrupt));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new PhotoError("corrupt", ERROR_MESSAGES.corrupt));
    };
    reader.onerror = () =>
      reject(new PhotoError("corrupt", ERROR_MESSAGES.corrupt));
    reader.readAsDataURL(blob);
  });
}

export async function preprocessPhoto(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoError("too_large", ERROR_MESSAGES.too_large);
  }
  if (!isAllowedPhotoType(file.type)) {
    throw new PhotoError("unsupported", ERROR_MESSAGES.unsupported);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await bitmapFromFile(file);
  } catch {
    try {
      bitmap = await bitmapFromImageElement(file);
    } catch (err) {
      if (err instanceof PhotoError) throw err;
      throw new PhotoError("unsupported", ERROR_MESSAGES.unsupported);
    }
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest < MIN_EDGE) {
      throw new PhotoError("corrupt", "That photo is too small. Try a clearer one.");
    }
    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new PhotoError("corrupt", ERROR_MESSAGES.corrupt);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let blob = await canvasToJpeg(canvas, quality);
    if (blob.size > MAX_OUTPUT_BYTES) {
      quality = 0.72;
      blob = await canvasToJpeg(canvas, quality);
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
      throw new PhotoError("too_large", ERROR_MESSAGES.too_large);
    }
    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}

export const MAX_DATA_URL_CHARS = 1_800_000;

export function validateImagePayload(image: string): "ok" | "no_image" | "unsupported" | "too_large" {
  if (!image) return "no_image";
  if (image.length > MAX_DATA_URL_CHARS) return "too_large";
  if (!image.startsWith("data:image/jpeg;base64,")) return "unsupported";
  const b64 = image.slice("data:image/jpeg;base64,".length);
  if (b64.length < 32) return "unsupported";
  if (/[^A-Za-z0-9+/=]/.test(b64.slice(0, 80))) return "unsupported";
  return "ok";
}
