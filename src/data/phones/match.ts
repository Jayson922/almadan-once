// src/data/phones/match.ts
// İlan başlığını okur, modeli veritabanındaki kayıtla eşleştirir ve
// ilandaki depolama / RAM iddialarını cihazın gerçek özellikleriyle karşılaştırır.
// Yapay zeka kullanmaz: aynı girdi her zaman aynı sonucu verir.
// Depolama değerleri GB cinsindendir (1 TB = 1024).

import type { PhoneSpec } from "./types";

const TR_MAP: Record<string, string> = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" };

/** Küçük harfe çevirir, Türkçe karakterleri sadeleştirir, harf, rakam ve "/" dışını boşluk yapar. */
export function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/\u0307/g, "")
    .replace(/[ışğüöç]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized
    .replace(/\//g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
}

function toGb(value: string, unit?: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "tb" || (!unit && n <= 4)) return n * 1024;
  if (n < 16 || n > 4096) return null;
  return n;
}

export interface ParsedListing {
  raw: string;
  tokens: string[];
  storageGb: number | null;
  ramGb: number | null;
}

export function parseListing(raw: string): ParsedListing {
  const norm = normalizeText(raw);
  let work = norm;
  let ram: number | null = null;
  let storage: number | null = null;

  const slash = work.match(/\b(\d{1,2})\s*(?:gb)?\s*\/\s*(\d{1,4})\s*(gb|tb)?\b/);
  if (slash && Number(slash[1]) <= 24) {
    const s = toGb(slash[2], slash[3]);
    if (s !== null) {
      ram = Number(slash[1]);
      storage = s;
      work = work.replace(slash[0], " ");
    }
  }

  if (ram === null) {
    const labeled = work.match(/\b(\d{1,2})\s*gb\s*ram\b/) ?? work.match(/\bram\s*(\d{1,2})\s*(?:gb)?\b/);
    if (labeled && Number(labeled[1]) <= 24) {
      ram = Number(labeled[1]);
      work = work.replace(labeled[0], " ");
    }
  }

  if (storage === null) {
    for (const m of work.matchAll(/\b(\d{1,4})\s*(gb|tb)\b/g)) {
      const s = toGb(m[1], m[2]);
      if (s !== null) {
        storage = s;
        break;
      }
    }
  }

  return { raw, tokens: tokenize(norm), storageGb: storage, ramGb: ram };
}

/** Model adının sonuna gelebilen ve modeli değiştiren ekler. */
const VARIANT_WORDS = new Set(["pro", "max", "plus", "mini", "ultra", "fe", "lite", "se", "air", "edge", "fold", "flip"]);
const LEADING_BRANDS = new Set(["samsung", "xiaomi", "google", "apple"]);

function nameVariants(name: string): string[][] {
  const t = tokenize(normalizeText(name));
  const out = [t];
  if (t.length > 1 && LEADING_BRANDS.has(t[0])) out.push(t.slice(1));
  return out;
}

function findSequence(hay: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > hay.length) return -1;
  for (let i = 0; i <= hay.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export interface ResolveResult {
  spec: PhoneSpec | null;
  /** 0 ile 1 arası. 0.9 ve üstü güvenilir, altı kullanıcıya doğrulatılmalı. */
  confidence: number;
  alternatives: PhoneSpec[];
  notes: string[];
  parsed: ParsedListing;
}

interface Hit {
  spec: PhoneSpec;
  len: number;
  end: number;
}

export function resolvePhone(raw: string, db: PhoneSpec[]): ResolveResult {
  const parsed = parseListing(raw);
  const hits: Hit[] = [];

  for (const spec of db) {
    let best: Hit | null = null;
    for (const name of [spec.model, ...spec.aliases]) {
      for (const seq of nameVariants(name)) {
        const i = findSequence(parsed.tokens, seq);
        if (i >= 0 && (!best || seq.length > best.len)) best = { spec, len: seq.length, end: i + seq.length - 1 };
      }
    }
    if (best) hits.push(best);
  }

  if (hits.length === 0) {
    return { spec: null, confidence: 0, alternatives: [], notes: ["Model veritabanında bulunamadı."], parsed };
  }

  hits.sort((a, b) => b.len - a.len);
  const top = hits.filter((h) => h.len === hits[0].len);
  const chosen = top[0];
  const notes: string[] = [];
  let confidence = 0.95;

  if (top.length > 1) {
    confidence = 0.5;
    notes.push("Birden fazla model aynı derecede eşleşti, kullanıcıya doğrulatılmalı.");
  }

  const next = parsed.tokens[chosen.end + 1];
  if (next && VARIANT_WORDS.has(next) && !normalizeText(chosen.spec.model).split(" ").includes(next)) {
    confidence = Math.min(confidence, 0.45);
    notes.push(`İlanda "${next}" ifadesi geçiyor ama eşleşen model bunu içermiyor. Daha üst bir varyant olabilir.`);
  }

  const alternatives = confidence < 0.9 ? hits.filter((h) => h.spec !== chosen.spec).slice(0, 3).map((h) => h.spec) : [];
  return { spec: chosen.spec, confidence, alternatives, notes, parsed };
}

export type FlagSeverity = "high" | "medium" | "low";
export interface SpecFlag {
  code: "storage_not_offered" | "ram_mismatch" | "old_model";
  severity: FlagSeverity;
  message: string;
}

function gbLabel(gb: number): string {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

/** İlandaki iddiaları cihazın gerçek özellikleriyle karşılaştırır. Listeye bakmayı bilen bir alıcının fark edeceği tutarsızlıkları bulur. */
export function validateAgainstSpec(
  spec: PhoneSpec,
  claims: { storageGb: number | null; ramGb: number | null },
  now: number = new Date().getFullYear(),
): SpecFlag[] {
  const flags: SpecFlag[] = [];

  if (claims.storageGb !== null && spec.storageGb.length > 0 && !spec.storageGb.includes(claims.storageGb)) {
    flags.push({
      code: "storage_not_offered",
      severity: "high",
      message: `${spec.model} için ${gbLabel(claims.storageGb)} seçeneği üretilmemiş (üretilenler: ${spec.storageGb.map(gbLabel).join(", ")}). İlan hatalı olabilir ya da cihaz orijinal olmayabilir.`,
    });
  }

  if (claims.ramGb !== null && spec.ramGb.length > 0 && !spec.ramGb.includes(claims.ramGb)) {
    flags.push({
      code: "ram_mismatch",
      severity: spec.ramSource === "official" ? "high" : "medium",
      message: `İlandaki ${claims.ramGb} GB RAM, ${spec.model} için bilinen değerlerle (${spec.ramGb.join(", ")} GB) uyuşmuyor.`,
    });
  }

  if (spec.releaseYear !== null && now - spec.releaseYear >= 5) {
    flags.push({
      code: "old_model",
      severity: "low",
      message: `${spec.model} ${spec.releaseYear} çıkışlı. Pil ömrü ve yazılım desteği süresi alım kararında ayrıca düşünülmeli.`,
    });
  }

  return flags;
}