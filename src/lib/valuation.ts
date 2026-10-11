import type { PriceVerdict } from "@/types/analysis";

export type Condition = "like_new" | "good" | "fair" | "poor";

export interface Comparable {
  title?: string;
  price: number;
  model: string; // normalize kimlik, ör. "iphone-13"
  storageGb?: number;
  condition?: Condition;
  hasBox?: boolean;
  hasInvoice?: boolean;
  hasWarranty?: boolean;
  source: string;
  url?: string;
  date?: string; // ISO
}

export interface Target {
  model: string;
  storageGb?: number;
  condition?: Condition;
  hasBox?: boolean;
  hasInvoice?: boolean;
  hasWarranty?: boolean;
}

export interface Valuation {
  counts: { received: number; matched: number; duplicates: number; stale: number; outliers: number; used: number };
  median: number | null;
  p25: number | null;
  p75: number | null;
  adjustedValue: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  confidence: number;
  notes: string[];
}

// Başlangıç katsayıları tahminidir. Gerçek ilan verisi birikince kalibre edilmelidir.
const COND = { like_new: 1.06, good: 1, fair: 0.92, poor: 0.8 } as const;

const round = (n: number, step = 100) => Math.round(n / step) * step;
const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9ğüşıöç]+/g, " ").trim();

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function factor(x: { condition?: Condition; hasBox?: boolean; hasInvoice?: boolean; hasWarranty?: boolean }) {
  let f = COND[x.condition ?? "good"];
  if (x.hasBox && x.hasInvoice) f *= 1.03;
  if (x.hasWarranty) f *= 1.04;
  return f;
}

export function valuate(target: Target, comps: Comparable[], opts: { maxAgeDays?: number; now?: Date } = {}): Valuation {
  const notes: string[] = [];
  const now = (opts.now ?? new Date()).getTime();
  const maxAge = (opts.maxAgeDays ?? 45) * 86400000;
  const received = comps.length;

  // 1. Eşleştirme: aynı model, uyumlu depolama, geçerli fiyat
  let pool = comps.filter((c) => Number.isFinite(c.price) && c.price > 0 && c.model === target.model);
  if (target.storageGb) pool = pool.filter((c) => !c.storageGb || c.storageGb === target.storageGb);
  const matched = pool.length;

  // 2. Eski ilanları ele
  const fresh = pool.filter((c) => {
    const t = c.date ? Date.parse(c.date) : NaN;
    return Number.isNaN(t) || now - t <= maxAge;
  });
  const stale = pool.length - fresh.length;

  // 3. Mükerrerleri ele (aynı bağlantı ya da aynı fiyat + başlık)
  const seen = new Set<string>();
  const unique = fresh.filter((c) => {
    const key = c.url ? "u:" + c.url : "t:" + c.price + "|" + norm(c.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicates = fresh.length - unique.length;

  // 4. Kondisyon ve belge farkını hedefe göre düzelt
  const unknownCond = unique.filter((c) => !c.condition).length;
  if (unknownCond > 0) notes.push(`${unknownCond} ilanın kondisyonu bilinmiyor, "iyi" varsayıldı.`);
  const ft = factor(target);
  const adj = unique.map((c) => (c.price / factor(c)) * ft);

  // 5. Aykırı değerleri ele (IQR, en az 5 ilan varsa)
  let kept = adj;
  if (adj.length >= 5) {
    const s = [...adj].sort((a, b) => a - b);
    const q1 = quantile(s, 0.25);
    const q3 = quantile(s, 0.75);
    const iqr = q3 - q1;
    kept = adj.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  } else if (adj.length > 0) {
    notes.push("Aykırı değer ayıklaması için en az 5 ilan gerekir.");
  }
  const outliers = adj.length - kept.length;

  const counts = { received, matched, duplicates, stale, outliers, used: kept.length };
  if (kept.length < 3) {
    notes.push("Güvenilir değerleme için yeterli karşılaştırılabilir ilan yok (en az 3).");
    return { counts, median: null, p25: null, p75: null, adjustedValue: null, rangeLow: null, rangeHigh: null, confidence: Math.min(25, kept.length * 8), notes };
  }

  // 6. Dağılım ve değer
  const s = [...kept].sort((a, b) => a - b);
  const median = quantile(s, 0.5);
  const p25 = quantile(s, 0.25);
  const p75 = quantile(s, 0.75);

  const sizeScore = Math.min(kept.length / 12, 1) * 60;
  const spread = (p75 - p25) / median;
  const spreadScore = Math.max(0, 1 - spread / 0.3) * 30;
  const dated = unique.filter((c) => c.date && now - Date.parse(c.date) <= 30 * 86400000).length;
  const recencyScore = unique.length && dated / unique.length >= 0.7 ? 10 : 0;
  const confidence = Math.round(sizeScore + spreadScore + recencyScore);

  return {
    counts,
    median: round(median),
    p25: round(p25),
    p75: round(p75),
    adjustedValue: round(median),
    rangeLow: round(p25),
    rangeHigh: round(p75),
    confidence,
    notes,
  };
}

export function judge(listingPrice: number, v: Valuation): {
  verdict: PriceVerdict;
  offerPrice: number | null;
  walkAwayPrice: number | null;
} {
  if (v.adjustedValue == null || v.rangeLow == null || v.rangeHigh == null || v.confidence < 30) {
    return { verdict: "unknown", offerPrice: null, walkAwayPrice: null };
  }
  const verdict: PriceVerdict =
    listingPrice <= v.rangeLow ? "great_deal" : listingPrice <= v.rangeHigh ? "fair" : "expensive";
  return {
    verdict,
    offerPrice: round(Math.min(v.adjustedValue * 0.96, listingPrice * 0.97)),
    walkAwayPrice: v.rangeHigh,
  };
}