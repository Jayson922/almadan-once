// src/lib/valuation.ts
// Değerleme motoru: eşleştirme, temizleme, IQR süzgeci, dağılım, düzeltilmiş değer, güven puanı ve karar.
// Sayıların tamamı burada KODLA hesaplanır. Yapay zeka sadece metin üretir.
// Yeterli gerçek ilan yoksa sahte veri ÜRETİLMEZ: marketPrice null ve estimated true döner.

export interface CompListing {
  title: string;
  price: number;
  source: string;
  condition?: string; // 'like_new' | 'good' | 'fair' | 'poor'
  url?: string;
  date?: string; // ISO tarih, biliniyorsa
}

export interface DeviceInfo {
  model: string;
  storage: string; // örn. "128GB", boş olabilir
  condition: string; // 'like_new' | 'good' | 'fair' | 'poor'
  hasBox: boolean;
  hasWarranty: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
  median: number;
  currency: string;
}

export interface UsedComp {
  title: string;
  price: number;
  source: string;
  url?: string;
}

export interface IqrRemoved {
  title: string;
  price: number; // ilandaki fiyat
  adjustedPrice: number; // kondisyona göre düzeltilmiş fiyat (süzgeç bunun üzerinde çalışır)
  source: string;
  side: "low" | "high";
}

export interface IqrDetails {
  applied: boolean; // süzgeç gerçekten uygulandı mı
  multiplier: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  beforeCount: number;
  afterCount: number;
  removed: IqrRemoved[]; // en fazla 10 kayıt
}

export interface ValuationBasis {
  receivedCount: number;
  matchedCount: number;
  usedCount: number; // hesaplamaya katılan ilan sayısı (yetersizse 0)
  invalidRemoved: number;
  excludedRemoved: number; // aksesuar, arızalı, sıfır ürün
  duplicatesRemoved: number;
  staleRemoved: number;
  mismatchRemoved: number; // model ya da depolama uyuşmayan
  outliersRemoved: number;
  notes: string;
  sources: string[];
  // Eşleşen gerçek ilanlar. İstatistik yetersizse hesaplamaya katılmaz ama listelenir.
  usedComps: UsedComp[];
  iqr: IqrDetails | null; // en az 5 eşleşen ilan yoksa null
}

export interface ValuationResult {
  marketPrice: PriceRange | null;
  confidence: number;
  estimated: boolean; // true ise gerçek ilan verisiyle hesaplanmış piyasa aralığı yok
  basis: ValuationBasis;
}

export type Verdict = "great_deal" | "fair" | "expensive" | "unknown";
export type Decision = "buy" | "negotiate" | "avoid" | "unknown";

export interface JudgmentResult {
  verdict: Verdict;
  decision: Decision;
  message: string;
  suggestedOffer: number;
  walkAwayPrice: number;
  suspiciouslyLow: boolean;
  estimated: boolean;
  deviationPct: number | null; // (ilan - medyan) / medyan * 100, bir ondalık; medyan yoksa null
}

// ---------------------------------------------------------------------------
// Sabitler ve Katsayılar
// ---------------------------------------------------------------------------

const MIN_COMPS = 3;
const IQR_MIN_COMPS = 5;
const IQR_MULTIPLIER = 1.5;
const MAX_AGE_DAYS = 45;
const MIN_PRICE = 1000;
const MAX_PRICE = 1_000_000;

const CONDITION_FACTOR: Record<string, number> = {
  like_new: 1.06,
  good: 1,
  fair: 0.92,
  poor: 0.8,
};
const BOX_FACTOR = 1.03;
const WARRANTY_FACTOR = 1.04;

const STOP_WORDS = new Set([
  "apple", "samsung", "galaxy", "xiaomi", "redmi", "poco", "oppo", "realme", "huawei", "telefon", "cep", "akıllı", "ikinci", "el",
  "gb", "tb", "ram", "temiz", "sorunsuz", "kutulu", "faturalı", "garantili", "yeni", "gibi",
]);
const VARIANTS = ["max", "plus", "mini", "ultra", "pro", "fe", "lite", "s"];
const VARIANT_SET = new Set(VARIANTS);
const VARIANTS_LONGEST_FIRST = [...VARIANTS].sort((a, b) => b.length - a.length);

const ACCESSORY_WORDS = new Set([
  "kılıf", "kilif", "kılıfı", "cam", "koruyucu", "adaptör", "adaptor", "kapak",
  "kablo", "kulaklık", "tutucu", "stand", "standı", "şarj", "sarj",
]);
const DEFECT_RE =
  /arızalı|hasarlı|çıkma|yedek parça|parça olarak|icloud kilitli|ekran kırık|kırık ekran|ekranı kırık|patlak ekran|bozuk|anakart|kilit/;
const NEW_RE = /sıfır|açılmamış|mühürlü|kapalı kutu/;
const NEW_OK_RE = /ayarında|gibi|kullanılmamış/;

// ---------------------------------------------------------------------------
// Yardımcı Fonksiyonlar
// ---------------------------------------------------------------------------

function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\u0307/g, "").replace(/\+/g, " plus ");
}

function tokenize(s: string): string[] {
  return norm(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function storagesIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.toLowerCase().matchAll(/(\d{1,4})\s?(gb|tb)/g)) {
    const n = Number(m[1]);
    out.push(m[2] === "tb" ? n * 1024 : n);
  }
  return out;
}

function conditionFactor(c?: string): number {
  return CONDITION_FACTOR[c ?? ""] ?? 1;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function urlKey(u: string): string {
  return u.toLowerCase().split("?")[0].split("#")[0].replace(/\/+$/, "");
}

function ageDays(date: string | undefined, now: number): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return (now - t) / 86_400_000;
}

function deviationPct(price: number, median: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(median) || median <= 0) return null;
  return Math.round(((price - median) / median) * 1000) / 10;
}

function buildModelMatcher(model: string, storage: string) {
  const cleaned = norm(model).replace(/(\d{1,4})\s?(gb|tb)/g, " ");
  const tokens = tokenize(cleaned).filter((t) => !STOP_WORDS.has(t));
  const baseTokens = tokens.filter((t) => !VARIANT_SET.has(t));
  const targetVariants = new Set(tokens.filter((t) => VARIANT_SET.has(t)));
  const baseCompact = baseTokens.join("");
  const targetStorage = storagesIn(storage || model)[0];

  function variantsFromRest(rest: string): Set<string> {
    const found = new Set<string>();
    let r = rest;
    let progressed = true;
    while (r.length > 0 && progressed) {
      progressed = false;
      for (const v of VARIANTS_LONGEST_FIRST) {
        if (r.startsWith(v)) {
          found.add(v);
          r = r.slice(v.length);
          progressed = true;
          break;
        }
      }
    }
    return found;
  }

  function sameSet(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  return function matches(title: string): "ok" | "model" | "storage" {
    if (baseTokens.length > 0) {
      const toks = tokenize(title);
      const tokSet = new Set(toks);
      const tokenMatch = baseTokens.every((t) => tokSet.has(t));
      const compact = toks.join("");
      const idx = compact.indexOf(baseCompact);
      const compactMatch = idx >= 0;
      if (!tokenMatch && !compactMatch) return "model";

      const compVariants = new Set(toks.filter((t) => VARIANT_SET.has(t)));
      if (!tokenMatch && compactMatch) {
        for (const v of variantsFromRest(compact.slice(idx + baseCompact.length))) {
          compVariants.add(v);
        }
      }
      if (!sameSet(targetVariants, compVariants)) return "model";
    }

    if (targetStorage !== undefined) {
      const nums = storagesIn(title);
      if (nums.length > 0 && !nums.includes(targetStorage)) return "storage";
    }
    return "ok";
  };
}

function emptyBasis(receivedCount: number): ValuationBasis {
  return {
    receivedCount,
    matchedCount: 0,
    usedCount: 0,
    invalidRemoved: 0,
    excludedRemoved: 0,
    duplicatesRemoved: 0,
    staleRemoved: 0,
    mismatchRemoved: 0,
    outliersRemoved: 0,
    notes: "",
    sources: [],
    usedComps: [],
    iqr: null,
  };
}

// ---------------------------------------------------------------------------
// Ana Değerleme Motoru
// ---------------------------------------------------------------------------

export function valuate(
  target: DeviceInfo,
  comps: CompListing[],
  now: number = Date.now()
): ValuationResult {
  const input = Array.isArray(comps) ? comps : [];
  const basis = emptyBasis(input.length);

  const matcher = buildModelMatcher(target.model, target.storage);
  const seen = new Set<string>();
  let kept: Array<{ c: CompListing; adj: number; dated: boolean }> = [];

  for (const c of input) {
    if (
      !c ||
      typeof c.title !== "string" ||
      typeof c.price !== "number" ||
      !Number.isFinite(c.price) ||
      c.price < MIN_PRICE ||
      c.price > MAX_PRICE
    ) {
      basis.invalidRemoved++;
      continue;
    }

    const t = norm(c.title);
    const toks = tokenize(c.title);
    const hasStorage = storagesIn(c.title).length > 0;
    const isAccessory = !hasStorage && toks.some((w) => ACCESSORY_WORDS.has(w));
    const isDefective = DEFECT_RE.test(t);
    const isNew = NEW_RE.test(t) && !NEW_OK_RE.test(t);
    if (isAccessory || isDefective || isNew) {
      basis.excludedRemoved++;
      continue;
    }

    const key = c.url ? `u:${urlKey(c.url)}` : `p:${Math.round(c.price)}|${toks.join("").slice(0, 28)}`;
    if (seen.has(key)) {
      basis.duplicatesRemoved++;
      continue;
    }
    seen.add(key);

    const age = ageDays(c.date, now);
    if (age !== null && age > MAX_AGE_DAYS) {
      basis.staleRemoved++;
      continue;
    }

    if (matcher(c.title) !== "ok") {
      basis.mismatchRemoved++;
      continue;
    }

    kept.push({ c, adj: c.price / conditionFactor(c.condition), dated: age !== null });
  }

  basis.matchedCount = kept.length;

  // Yeterli gerçek ilan yoksa sahte veri üretilmez: piyasa aralığı hesaplanamaz.
  if (kept.length < MIN_COMPS) {
    basis.usedCount = 0;
    basis.sources = Array.from(new Set(kept.map((k) => k.c.source).filter(Boolean)));
    basis.usedComps = kept.slice(0, 12).map((k) => ({
      title: k.c.title,
      price: k.c.price,
      source: k.c.source,
      url: k.c.url,
    }));
    if (basis.receivedCount === 0) {
      basis.notes = "Canlı pazar taramasından hiç ilan alınamadı. Piyasa aralığı hesaplanamadı.";
    } else if (kept.length === 0) {
      basis.notes = `Gelen ${basis.receivedCount} ilandan hiçbiri model, depolama ve güvenlik süzgecini geçemedi. Piyasa aralığı hesaplanamadı.`;
    } else {
      basis.notes = `${kept.length} eşleşen ilan bulundu; istatistiksel aralık için en az ${MIN_COMPS} gerekir. Piyasa aralığı hesaplanamadı.`;
    }
    return { marketPrice: null, confidence: 0, estimated: true, basis };
  }

  // Aykırı Değer Temizliği (IQR)
  if (kept.length >= IQR_MIN_COMPS) {
    const sortedAll = kept.map((k) => k.adj).sort((a, b) => a - b);
    const q1 = quantile(sortedAll, 0.25);
    const q3 = quantile(sortedAll, 0.75);
    const iqr = q3 - q1;
    const lo = q1 - IQR_MULTIPLIER * iqr;
    const hi = q3 + IQR_MULTIPLIER * iqr;
    const inliers = kept.filter((k) => k.adj >= lo && k.adj <= hi);
    const applied = inliers.length >= MIN_COMPS;

    const removed: IqrRemoved[] = applied
      ? kept
          .filter((k) => k.adj < lo || k.adj > hi)
          .slice(0, 10)
          .map((k) => ({
            title: k.c.title,
            price: k.c.price,
            adjustedPrice: Math.round(k.adj),
            source: k.c.source,
            side: k.adj < lo ? ("low" as const) : ("high" as const),
          }))
      : [];

    basis.iqr = {
      applied,
      multiplier: IQR_MULTIPLIER,
      q1: Math.round(q1),
      q3: Math.round(q3),
      iqr: Math.round(iqr),
      lowerFence: Math.round(lo),
      upperFence: Math.round(hi),
      beforeCount: kept.length,
      afterCount: applied ? inliers.length : kept.length,
      removed,
    };

    if (applied) {
      basis.outliersRemoved = kept.length - inliers.length;
      kept = inliers;
    }
  }

  const adjSorted = kept.map((k) => k.adj).sort((a, b) => a - b);
  const median = quantile(adjSorted, 0.5);
  const p25 = quantile(adjSorted, 0.25);
  const p75 = quantile(adjSorted, 0.75);

  const factor =
    conditionFactor(target.condition) *
    (target.hasBox ? BOX_FACTOR : 1) *
    (target.hasWarranty ? WARRANTY_FACTOR : 1);

  const finalMedian = round100(median * factor);
  const finalMin = Math.min(round100(p25 * factor), finalMedian);
  const finalMax = Math.max(round100(p75 * factor), finalMedian);

  const used = kept.length;
  const cv = median > 0 ? (p75 - p25) / median : 1;
  const countScore = Math.min(30, used * 4);
  const spreadScore = clamp(25 * (1 - cv / 0.4), 0, 25);
  const datedShare = kept.filter((k) => k.dated).length / used;
  const freshScore = 6 + 9 * datedShare;
  const confidence = Math.round(clamp(10 + countScore + spreadScore + freshScore, 40, 95));

  const sources = Array.from(new Set(kept.map((k) => k.c.source).filter(Boolean)));
  basis.usedCount = used;
  basis.sources = sources;
  basis.usedComps = kept.slice(0, 12).map((k) => ({
    title: k.c.title,
    price: k.c.price,
    source: k.c.source,
    url: k.c.url,
  }));
  basis.notes =
    basis.outliersRemoved > 0
      ? `${used} doğrulanmış ilan analiz edildi. IQR süzgeci ${basis.outliersRemoved} aykırı ilanı eledi.`
      : `${used} doğrulanmış ilan analiz edildi.`;

  return {
    marketPrice: { min: finalMin, max: finalMax, median: finalMedian, currency: "TL" },
    confidence,
    estimated: false,
    basis,
  };
}

// ---------------------------------------------------------------------------
// Karar ve Tavsiye Motoru
// ---------------------------------------------------------------------------

export function judge(price: number, valuation: ValuationResult): JudgmentResult {
  const mp = valuation.marketPrice;

  if (!mp) {
    return {
      verdict: "unknown",
      decision: "unknown",
      message: "Yeterli canlı ilan bulunamadı; fiyat kararı verilemiyor.",
      suggestedOffer: round100(price * 0.92),
      walkAwayPrice: price,
      suspiciouslyLow: false,
      estimated: true,
      deviationPct: null,
    };
  }

  const { min, max, median } = mp;
  const dev = deviationPct(price, median);
  const suggestedOffer = round100(Math.min(median * 0.96, price * 0.97));
  const walkAwayPrice = Math.max(max, suggestedOffer);
  const suspiciouslyLow = price < min * 0.75;

  if (price <= min * 0.98) {
    return {
      verdict: "great_deal",
      decision: suspiciouslyLow ? "negotiate" : "buy",
      message: suspiciouslyLow
        ? "Fiyat piyasa ortalamasının çok altında. Dolandırıcılık veya gizli arıza riski yüksek, elden test etmeden kapora göndermeyin."
        : "Fiyat avantajlı aralıkta. Koşullar doğrulanırsa iyi bir fırsat.",
      suggestedOffer,
      walkAwayPrice,
      suspiciouslyLow,
      estimated: valuation.estimated,
      deviationPct: dev,
    };
  }

  if (price <= max) {
    const cheapEnough = price <= median * 1.02;
    return {
      verdict: "fair",
      decision: cheapEnough ? "buy" : "negotiate",
      message: cheapEnough
        ? "Fiyat adil piyasa medyanında. Cihaz temizse güvenle alınabilir."
        : "Fiyat piyasa bandında ancak medyanın üzerinde, pazarlık yapılmalı.",
      suggestedOffer,
      walkAwayPrice,
      suspiciouslyLow: false,
      estimated: valuation.estimated,
      deviationPct: dev,
    };
  }

  const farAbove = price > max * 1.15;
  return {
    verdict: "expensive",
    decision: farAbove ? "avoid" : "negotiate",
    message: farAbove
      ? "Fiyat piyasa üst sınırının çok üzerinde. Bu fiyattan kesinlikle kaçının."
      : "Fiyat yüksek ancak makul bir teklifle pazarlık masasına oturulabilir.",
    suggestedOffer,
    walkAwayPrice,
    suspiciouslyLow: false,
    estimated: valuation.estimated,
    deviationPct: dev,
  };
}