import type { PriceVerdict } from "@/types/analysis";

export type Condition = "new" | "like_new" | "good" | "fair" | "poor";

export interface Comparable {
  price: number;
  condition?: Condition;
  source?: string;
  id?: string;
  storageGb?: number;
  /** ISO tarih, örn. "2026-10-05" */
  listedAt?: string;
}

/** Kondisyon katsayıları: "good" = 1 baz alınır. Başlangıç değerleridir, gerçek veriyle ayarlanmalı. */
export const CONDITION_FACTOR: Record<Condition, number> = {
  new: 1.12,
  like_new: 1.05,
  good: 1,
  fair: 0.9,
  poor: 0.75,
};

export interface EstimateOptions {
  targetCondition?: Condition;
  maxAgeDays?: number;
  now?: Date;
}

export type ConfidenceLabel = "Düşük" | "Orta" | "Yüksek";

export interface MarketEstimate {
  median: number | null;
  mean: number | null;
  /** Adil fiyat bandı */
  fairLow: number | null;
  fairHigh: number | null;
  /** Ham çeyrekler (p25 - p75) */
  q1: number | null;
  q3: number | null;
  inputCount: number;
  usedCount: number;
  removed: { invalid: number; stale: number; duplicates: number; outliers: number };
  /** (q3 - q1) / medyan: küçük = tutarlı piyasa */
  dispersion: number | null;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  notes: string[];
}

const DAY_MS = 86_400_000;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score < 35) return "Düşük";
  if (score < 65) return "Orta";
  return "Yüksek";
}

function emptyEstimate(
  inputCount: number,
  removed: MarketEstimate["removed"],
  note: string,
): MarketEstimate {
  return {
    median: null,
    mean: null,
    fairLow: null,
    fairHigh: null,
    q1: null,
    q3: null,
    inputCount,
    usedCount: 0,
    removed,
    dispersion: null,
    confidence: 0,
    confidenceLabel: "Düşük",
    notes: [note],
  };
}

interface Item {
  adjusted: number;
  fresh: boolean | null;
}

export function estimateMarketValue(
  comparables: Comparable[],
  options: EstimateOptions = {},
): MarketEstimate {
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? 60;
  const targetFactor = CONDITION_FACTOR[options.targetCondition ?? "good"];
  const removed = { invalid: 0, stale: 0, duplicates: 0, outliers: 0 };
  const notes: string[] = [];

  // 1) Geçersiz, eski ve mükerrer kayıtları ayıkla
  const seen = new Set<string>();
  let items: Item[] = [];

  for (const c of comparables) {
    if (!Number.isFinite(c.price) || c.price <= 0) {
      removed.invalid++;
      continue;
    }

    let fresh: boolean | null = null;
    if (c.listedAt) {
      const t = Date.parse(c.listedAt);
      if (Number.isFinite(t)) {
        const ageDays = (now.getTime() - t) / DAY_MS;
        if (ageDays > maxAgeDays) {
          removed.stale++;
          continue;
        }
        fresh = ageDays <= 30;
      }
    }

    const key = c.id ?? `${c.source ?? ""}|${Math.round(c.price)}|${c.storageGb ?? ""}|${c.condition ?? ""}`;
    if (seen.has(key)) {
      removed.duplicates++;
      continue;
    }
    seen.add(key);

    items.push({
      adjusted: c.price / CONDITION_FACTOR[c.condition ?? "good"],
      fresh,
    });
  }

  if (items.length === 0) {
    return emptyEstimate(comparables.length, removed, "Kullanılabilir karşılaştırma verisi yok.");
  }

  // 2) Aykırı değerler: IQR çiti VEYA MAD z-skoru; en fazla %30 elenir
  if (items.length >= 5) {
    const sorted = items.map((i) => i.adjusted).sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const med = quantile(sorted, 0.5);
    const mad = median(sorted.map((v) => Math.abs(v - med)));

    const candidates = items
      .map((item, index) => {
        const outFence = item.adjusted < q1 - 1.5 * iqr || item.adjusted > q3 + 1.5 * iqr;
        const outMad = mad > 0 && Math.abs((0.6745 * (item.adjusted - med)) / mad) > 3.5;
        return { index, dist: Math.abs(item.adjusted - med), out: outFence || outMad };
      })
      .filter((c) => c.out)
      .sort((a, b) => b.dist - a.dist);

    const cap = Math.floor(items.length * 0.3);
    const drop = new Set(candidates.slice(0, cap).map((c) => c.index));
    if (candidates.length > cap) {
      notes.push("Çok sayıda uç değer vardı; yalnızca en uçtakiler çıkarıldı. Veri tutarsız olabilir.");
    }
    removed.outliers = drop.size;
    items = items.filter((_, i) => !drop.has(i));
  } else {
    notes.push("Örnek sayısı az (5'ten düşük): aykırı değer süzgeci uygulanmadı.");
  }

  // 3) Tahmin
  const values = items.map((i) => i.adjusted).sort((a, b) => a - b);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const med = quantile(values, 0.5);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const dispersion = med > 0 ? (q3 - q1) / med : null;

  const scale = (v: number): number => Math.round(v * targetFactor);
  const medianPrice = scale(med);
  // Adil bant: çeyrekler çok darsa medyanın ±%8 i kadar genişletilir
  const fairLow = scale(Math.min(q1, med * 0.92));
  const fairHigh = scale(Math.max(q3, med * 1.08));

  // 4) Güven skoru (0-100): örnek sayısı 50, tutarlılık 35, tazelik 15
  const nScore = Math.min(1, items.length / 12) * 50;
  const dispScore = dispersion === null ? 0 : clamp(1 - dispersion / 0.5, 0, 1) * 35;
  const known = items.filter((i) => i.fresh !== null);
  const freshScore =
    known.length === 0 ? 7 : (known.filter((i) => i.fresh).length / known.length) * 15;

  let confidence = Math.round(nScore + dispScore + freshScore);
  if (items.length < 3) {
    confidence = Math.min(confidence, 30);
    notes.push("3'ten az karşılaştırma: tahmin yalnızca kaba bir fikir verir.");
  }
  if (known.length === 0) {
    notes.push("İlan tarihleri yok: güncellik doğrulanamadı.");
  }
  if (dispersion !== null && dispersion > 0.4) {
    notes.push("Fiyatlar birbirinden çok farklı: model, depolama ya da kondisyon karışmış olabilir.");
  }

  return {
    median: medianPrice,
    mean: scale(mean),
    fairLow,
    fairHigh,
    q1: scale(q1),
    q3: scale(q3),
    inputCount: comparables.length,
    usedCount: items.length,
    removed,
    dispersion: dispersion === null ? null : Math.round(dispersion * 100) / 100,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    notes,
  };
}

export interface PriceRating {
  verdict: PriceVerdict;
  /** İlan fiyatının medyandan sapması (%): negatif = ucuz */
  deltaPercent: number | null;
  notes: string[];
}

export function rateListingPrice(listingPrice: number, estimate: MarketEstimate): PriceRating {
  if (
    !Number.isFinite(listingPrice) ||
    listingPrice <= 0 ||
    estimate.median === null ||
    estimate.fairLow === null ||
    estimate.fairHigh === null
  ) {
    return { verdict: "unknown", deltaPercent: null, notes: ["Karşılaştırma için yeterli veri yok."] };
  }

  const notes: string[] = [];
  const deltaPercent = Math.round(((listingPrice - estimate.median) / estimate.median) * 100);

  let verdict: PriceVerdict;
  if (listingPrice < estimate.fairLow) verdict = "great_deal";
  else if (listingPrice <= estimate.fairHigh) verdict = "fair";
  else verdict = "expensive";

  if (listingPrice < estimate.median * 0.5) {
    notes.push("Fiyat medyanın yarısından düşük: fırsattan çok sahte ilan ya da gizli kusur ihtimalini düşünün.");
  }
  if (estimate.confidenceLabel === "Düşük") {
    notes.push("Tahmin güveni düşük: bu karara tek başına dayanmayın.");
  }

  return { verdict, deltaPercent, notes };
}