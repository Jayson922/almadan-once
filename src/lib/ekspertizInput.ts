import { z } from "zod";

export const MIN_PRICE_TL = 1_000;
export const MAX_PRICE_TL = 1_000_000;
export const MAX_IMAGE_CHARS = 7_000_000;
export const MIN_BATTERY_PCT = 50;
export const MAX_BATTERY_PCT = 100;
export const MIN_USAGE_MONTHS = 0;
export const MAX_USAGE_MONTHS = 120;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface EkspertizInput {
  model: string;
  listingPrice: number;
  tags: string[];
  sellerNote: string;
  image: { mimeType: ImageMime; data: string } | null;
  imageRejected: boolean;
  /** Kullanıcı beyanı pil sağlığı yüzdesi; girilmediyse null */
  batteryHealthPct: number | null;
  /** Cihazın kaç aydır kullanıldığı; girilmediyse null */
  usageMonths: number | null;
}

export type EkspertizParseResult =
  | { ok: true; data: EkspertizInput }
  | { ok: false; error: string };

function cleanLine(s: string, max: number): string {
  return s
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/[<>"`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanBlock(s: string, max: number): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

/** Dosyanın ilk baytlarına bakarak gerçek görsel türünü bulur. */
export function detectImageMime(base64: string): ImageMime | null {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head.toString("ascii", 0, 4) === "RIFF" &&
    head.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function parseImage(x: unknown): { image: EkspertizInput["image"]; rejected: boolean } {
  if (typeof x !== "string" || x.length === 0) return { image: null, rejected: false };
  if (x.length > MAX_IMAGE_CHARS) return { image: null, rejected: true };

  const m = x.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
  const data = (m ? m[1] : x).replace(/\s+/g, "");
  if (!m && !/^[A-Za-z0-9+/=]{100,}$/.test(data)) return { image: null, rejected: true };

  const mimeType = detectImageMime(data);
  if (!mimeType) return { image: null, rejected: true };
  return { image: { mimeType, data }, rejected: false };
}

type OptionalIntResult = { ok: true; value: number | null } | { ok: false };

/** Boş, null ya da boş metin null döner. Aralık dışı ya da sayı olmayan değer hata sayılır. */
function parseOptionalInt(x: unknown, min: number, max: number): OptionalIntResult {
  if (x === undefined || x === null) return { ok: true, value: null };
  const raw = typeof x === "string" ? x.trim().replace(",", ".") : x;
  if (raw === "") return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return { ok: false };
  return { ok: true, value: Math.round(n) };
}

const PRICE_MSG = `Lütfen ${MIN_PRICE_TL.toLocaleString("tr-TR")} TL ile ${MAX_PRICE_TL.toLocaleString("tr-TR")} TL arasında geçerli bir ilan fiyatı girin.`;
const BATTERY_MSG = `Pil sağlığı %${MIN_BATTERY_PCT} ile %${MAX_BATTERY_PCT} arasında bir değer olmalı.`;
const USAGE_MSG = `Kullanım süresi ${MIN_USAGE_MONTHS} ile ${MAX_USAGE_MONTHS} ay arasında olmalı.`;

const inputSchema = z.object({
  model: z.string({ error: "Lütfen geçerli bir cihaz modeli girin." }),
  listingPrice: z.union([z.number(), z.string()], { error: PRICE_MSG }),
  tags: z.array(z.unknown(), { error: "Etiketler liste olmalı." }).optional(),
  sellerNote: z.string({ error: "Satıcı notu metin olmalı." }).optional(),
  image: z.unknown().optional(),
  batteryHealthPct: z.union([z.number(), z.string(), z.null()], { error: BATTERY_MSG }).optional(),
  usageMonths: z.union([z.number(), z.string(), z.null()], { error: USAGE_MSG }).optional(),
});

export function parseEkspertizInput(body: unknown): EkspertizParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Geçersiz istek gövdesi." };
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  }
  const d = parsed.data;

  const model = cleanLine(d.model, 120);
  if (model.length < 2) {
    return { ok: false, error: "Lütfen geçerli bir cihaz modeli girin." };
  }

  const price = typeof d.listingPrice === "number" ? d.listingPrice : Number(d.listingPrice);
  if (!Number.isFinite(price) || price < MIN_PRICE_TL || price > MAX_PRICE_TL) {
    return { ok: false, error: PRICE_MSG };
  }

  const battery = parseOptionalInt(d.batteryHealthPct, MIN_BATTERY_PCT, MAX_BATTERY_PCT);
  if (!battery.ok) return { ok: false, error: BATTERY_MSG };

  const usage = parseOptionalInt(d.usageMonths, MIN_USAGE_MONTHS, MAX_USAGE_MONTHS);
  if (!usage.ok) return { ok: false, error: USAGE_MSG };

  const tags = (d.tags ?? [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => cleanLine(t, 40))
    .filter(Boolean)
    .slice(0, 12);

  const sellerNote = d.sellerNote ? cleanBlock(d.sellerNote, 2000) : "";
  const { image, rejected } = parseImage(d.image);

  return {
    ok: true,
    data: {
      model,
      listingPrice: Math.round(price),
      tags,
      sellerNote,
      image,
      imageRejected: rejected,
      batteryHealthPct: battery.value,
      usageMonths: usage.value,
    },
  };
}