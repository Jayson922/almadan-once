export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Sadece JPG, JPEG, PNG veya WEBP dosyaları yüklenebilir.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Dosya boyutu en fazla 5 MB olabilir.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}