// src/lib/marketEngine.ts
// ALMADAN ÖNCE — Piyasa Motoru (Grup 7)
// Bağımlılık yok, saf TypeScript, deterministik (aynı girdi = aynı çıktı).
//
// Akış:
//  1) Normalize et (fiyat, depolama, kondisyon, tarih)
//  2) Uygun değilleri ele (aksesuar, farklı varyant, parça/arızalı)
//  3) Mükerrer ilanları birleştir
//  4) Hedef ürüne göre fiyat düzelt (depolama + kondisyon)
//  5) Aykırı değerleri ayıkla (log uzayında Tukey + MAD)
//  6) İlan kalitesi x tazelik x kaynak güveni = ağırlık
//  7) Ağırlıklı medyan, çeyreklikler, bootstrap güven aralığı
//  8) Veri azsa önsel (statik fiyat tablosu) ile Bayes harmanı
//  9) Kullanıcının ilanı için karar + pazarlık planı

// ───────────────────────── Tipler ─────────────────────────

export type Condition = "sifir" | "cok_iyi" | "iyi" | "orta" | "hasarli" | "bilinmiyor";
export type SellerType = "bireysel" | "galerici" | "magaza" | "bilinmiyor";

export interface RawListing {
  id?: string;
  source: string; // "sahibinden" | "letgo" | "dolap" | "gemini-search" ...
  url?: string;
  title: string;
  price: number | string; // 45000 | "45.000 TL" | "45 bin"
  description?: string;
  postedAt?: string | Date;
  photoCount?: number;
  sellerType?: SellerType;
  storageGb?: number;
  condition?: Condition;
  batteryHealth?: number; // 0-100
  hasWarranty?: boolean;
  city?: string;
}

export interface MarketQuery {
  brand: string; // "Apple"
  model: string; // "iPhone 13"
  storageGb?: number;
  condition?: Condition;
  listingPrice?: number | string; // kullanıcının baktığı ilan fiyatı
  subject?: RawListing; // kullanıcının ilanı (kalite skoru için)
  now?: Date;
  prior?: { min: number; median: number; max: number }; // statik fiyat tablosu
}

export interface QualityResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D";
  reasons: string[];
  flags: string[];
}

export interface UsedListing {
  id: string;
  source: string;
  url?: string;
  title: string;
  price: number;
  adjustedPrice: number;
  weight: number;
  quality: QualityResult;
  ageDays: number | null;
}

export type Verdict = "supheli_ucuz" | "firsat" | "makul" | "biraz_pahali" | "pahali";

export interface MarketResult {
  status: "ok" | "low_data" | "prior_only" | "no_data";
  range: { p10: number; p25: number; median: number; p75: number; p90: number } | null;
  medianCI80: [number, number] | null;
  confidence: { score: number; label: "yuksek" | "orta" | "dusuk" };
  sample: { received: number; used: number; effective: number; sources: string[]; priorShare: number };
  rejected: Record<string, number>;
  verdict: null | {
    verdict: Verdict;
    percentile: number;
    deltaVsMedianPct: number;
    message: string;
  };
  negotiation: null | { opening: number; fair: number; walkAway: number };
  subjectQuality: QualityResult | null;
  topComparables: UsedListing[];
  warnings: string[];
}

// ───────────────────────── Ayarlar ─────────────────────────

const CFG = {
  halfLifeDays: 14,
  recencyFloor: 0.15,
  storageStepPct: 0.12, // depolama her ikiye katlandığında ~%12 fiyat farkı
  conditionFactor: { sifir: 1.18, cok_iyi: 1.07, iyi: 1.0, orta: 0.88, hasarli: 0.6, bilinmiyor: 1.0 } as Record<Condition, number>,
  sourceTrust: { sahibinden: 0.95, dolap: 0.85, letgo: 0.75, "gemini-search": 0.7 } as Record<string, number>,
  defaultSourceTrust: 0.7,
  priorStrength: 3, // önsel, kaç "etkin ilan" ağırlığında
  bootstrapRuns: 400,
  minUsedForOk: 6,
};

const VALID_STORAGE = [32, 64, 128, 256, 512, 1024];
const VARIANTS = ["pro", "max", "plus", "mini", "ultra", "fe", "lite", "se", "fold", "flip"];
const ACCESSORY = /\b(kilif|kapak|koruyucu|sarj|kablo|kulaklik|kutu(?:su)? tek|yedek parca|aksesuar|cam)\b/;
const DEFECT = "kirik|catlak|cizik|ariza|arizasi|degisen|boya|boyali|hasar|tamir|dusme";
const NEGATED = new RegExp(`\\b(?:(?:${DEFECT})[\\s,/&-]*(?:ve\\s+)?)+(?:yok|yoktur|bulunmuyor|bulunmamaktadir)\\b|\\b(?:boyasiz|degisensiz|arizasiz|hatasiz|tamirsiz)\\b`, "g");

// ───────────────────────── Yardımcılar ─────────────────────────

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const compact = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");

export function parsePriceTRY(v: number | string | undefined | null): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (!v) return null;
  let s = norm(String(v)).replace(/\s/g, "");
  const bin = /(\d+(?:[.,]\d+)?)bin/.exec(s);
  if (bin) return Math.round(parseFloat(bin[1].replace(",", ".")) * 1000);
  s = s.replace(/[^\d.,]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/[.,]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function roundTRY(x: number): number {
  const step = x >= 10000 ? 100 : 50;
  return Math.round(x / step) * step;
}

function wQuantile(items: { v: number; w: number }[], q: number): number {
  if (items.length === 0) return NaN;
  const a = [...items].sort((x, y) => x.v - y.v);
  const total = a.reduce((s, i) => s + i.w, 0);
  let cum = 0;
  const pos = a.map((i) => {
    const p = (cum + i.w / 2) / total;
    cum += i.w;
    return p;
  });
  if (q <= pos[0]) return a[0].v;
  if (q >= pos[pos.length - 1]) return a[a.length - 1].v;
  for (let i = 0; i < a.length - 1; i++) {
    if (q >= pos[i] && q <= pos[i + 1]) {
      const t = (q - pos[i]) / (pos[i + 1] - pos[i] || 1);
      return a[i].v + t * (a[i + 1].v - a[i].v);
    }
  }
  return a[a.length - 1].v;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── Çıkarım ─────────────────────────

export function extractStorage(text: string): number | undefined {
  const t = norm(text);
  const found: number[] = [];
  const re = /(\d{1,4})\s?(gb|tb)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = parseInt(m[1], 10) * (m[2] === "tb" ? 1024 : 1);
    if (VALID_STORAGE.includes(n)) found.push(n);
  }
  return found.length ? Math.max(...found) : undefined;
}

export function inferCondition(text: string): Condition {
  const t = norm(text).replace(NEGATED, " ");
  if (/(arizali|parca|kirik|catlak|calismiyor|kilitli|hasarli|yanik|su gordu)/.test(t)) return "hasarli";
  if (/(sifir ayar|hic kullanilmadi|kusursuz|hatasiz|kutulu|faturali|garantili|ilk sahib)/.test(t)) return "cok_iyi";
  if (/\bsifir\b|acilmamis|jelatinli/.test(t)) return "sifir";
  if (/(cizik|iz var|kullanim izi|degisen|boyali|dusme)/.test(t)) return "orta";
  if (/\btemiz\b|bakimli|sorunsuz/.test(t)) return "iyi";
  return "bilinmiyor";
}

function ageDays(d: string | Date | undefined, now: Date): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 86400000);
}

// ───────────────────────── İlan kalitesi ─────────────────────────

export function scoreListingQuality(l: RawListing, now: Date = new Date(), medianForPrice?: number): QualityResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  let s = 0;
  const text = `${l.title} ${l.description ?? ""}`;
  const t = norm(text);
  const price = parsePriceTRY(l.price);

  if (price) s += 10;
  const dl = (l.description ?? "").trim().length;
  if (dl >= 120) { s += 15; reasons.push("Ayrıntılı açıklama"); }
  else if (dl >= 40) { s += 8; reasons.push("Kısa açıklama"); }
  else flags.push("Açıklama çok kısa/yok");

  const pc = l.photoCount ?? 0;
  if (pc >= 5) { s += 15; reasons.push("5+ fotoğraf"); }
  else if (pc >= 2) s += 8;
  else if (pc === 1) { s += 3; flags.push("Tek fotoğraf"); }
  else flags.push("Fotoğraf bilgisi yok");

  if (l.storageGb ?? extractStorage(text)) s += 10; else flags.push("Depolama belirtilmemiş");
  const cond = l.condition ?? inferCondition(text);
  if (cond !== "bilinmiyor") s += 10; else flags.push("Kondisyon belirtilmemiş");
  if (l.batteryHealth != null || /pil|batarya|saglik/.test(t)) { s += 10; reasons.push("Pil sağlığı bilgisi"); }
  if (l.hasWarranty != null || /garanti|fatura/.test(t)) { s += 5; reasons.push("Garanti/fatura bilgisi"); }
  if (l.sellerType && l.sellerType !== "bilinmiyor") s += 5;

  const age = ageDays(l.postedAt, now);
  if (age != null) {
    s += 5;
    s += age <= 7 ? 10 : age <= 30 ? 6 : age <= 90 ? 2 : 0;
    if (age > 60) flags.push("İlan eski (bayat olabilir)");
  } else flags.push("İlan tarihi yok");

  if (/(kapora|on odeme|once havale|once iban)/.test(t)) { s -= 25; flags.push("Kapora/ön ödeme talebi"); }
  else if (/(iban|whatsapp\b.*\bkargo)/.test(t)) { s -= 10; flags.push("Platform dışı ödeme/iletişim ipucu"); }
  const letters = l.title.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) { s -= 5; flags.push("Başlık tamamen büyük harf"); }
  if (medianForPrice && price && price < medianForPrice * 0.6) { s -= 15; flags.push("Piyasanın çok altında fiyat"); }

  const score = clamp(Math.round(s), 0, 100);
  const grade = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
  return { score, grade, reasons, flags };
}

// ───────────────────────── Model eşleşme ─────────────────────────

function modelMatches(title: string, q: MarketQuery): "ok" | "model" | "variant" {
  const tk = new Set(tokens(title));
  const ct = compact(title);
  const modelTokens = tokens(q.model);
  const cm = compact(q.model);
  const hit = modelTokens.every((x) => tk.has(x)) || ct.includes(cm);
  if (!hit) return "model";
  const qv = new Set(VARIANTS.filter((v) => modelTokens.includes(v)));
  for (const v of VARIANTS) {
    const inTitle = tk.has(v) || ct.includes(cm + v);
    if (inTitle !== qv.has(v)) return "variant";
  }
  return "ok";
}

// ───────────────────────── Ana motor ─────────────────────────

interface Cand {
  raw: RawListing;
  id: string;
  price: number;
  adjusted: number;
  comp: number;
  quality: QualityResult;
  age: number | null;
  tk: Set<string>;
}

export function analyzeMarket(listings: RawListing[], q: MarketQuery): MarketResult {
  const now = q.now ?? new Date();
  const rejected: Record<string, number> = {};
  const rej = (k: string) => (rejected[k] = (rejected[k] ?? 0) + 1);
  const warnings: string[] = [];
  const targetCond: Condition = q.condition && q.condition !== "bilinmiyor" ? q.condition : "iyi";

  // 1-2) normalize + uygunluk
  let cands: Cand[] = [];
  listings.forEach((raw, i) => {
    const price = parsePriceTRY(raw.price);
    if (!price) return rej("fiyat_okunamadi");
    const text = `${raw.title} ${raw.description ?? ""}`;
    if (ACCESSORY.test(norm(raw.title)) && price < 3000) return rej("aksesuar");
    const m = modelMatches(raw.title, q);
    if (m === "model") return rej("model_uyusmuyor");
    if (m === "variant") return rej("varyant_uyusmuyor");
    const cond = raw.condition ?? inferCondition(text);
    if (cond === "hasarli" && targetCond !== "hasarli") return rej("arizali_parca");

    let comp = 1;
    let adj = price;
    const st = raw.storageGb ?? extractStorage(text);
    if (q.storageGb) {
      if (st && st !== q.storageGb) {
        const steps = Math.log2(st / q.storageGb);
        if (Math.abs(steps) > 2) return rej("depolama_cok_farkli");
        adj = adj / Math.pow(1 + CFG.storageStepPct, steps);
        comp *= 0.85;
      } else if (!st) comp *= 0.6;
    }
    if (cond !== "bilinmiyor") adj = (adj * CFG.conditionFactor[targetCond]) / CFG.conditionFactor[cond];
    else comp *= 0.7;

    cands.push({
      raw, id: raw.id ?? `${raw.source}-${i}`, price, adjusted: adj, comp,
      quality: scoreListingQuality(raw, now), age: ageDays(raw.postedAt, now), tk: new Set(tokens(raw.title)),
    });
  });

  // 3) mükerrer
  cands.sort((a, b) => b.quality.score - a.quality.score || (a.age ?? 1e9) - (b.age ?? 1e9));
  const kept: Cand[] = [];
  for (const c of cands) {
    const dup = kept.some((k) => {
      if (k.raw.url && c.raw.url && k.raw.url === c.raw.url) return true;
      const inter = [...c.tk].filter((x) => k.tk.has(x)).length;
      const jac = inter / (new Set([...c.tk, ...k.tk]).size || 1);
      return jac >= 0.85 && Math.abs(k.price - c.price) / k.price <= 0.02;
    });
    if (dup) rej("mukerrer"); else kept.push(c);
  }
  cands = kept;

  // 5) aykırı değer (log uzayı)
  if (cands.length >= 5) {
    const lv = cands.map((c) => ({ v: Math.log(c.adjusted), w: 1 }));
    const q1 = wQuantile(lv, 0.25), q3 = wQuantile(lv, 0.75), med = wQuantile(lv, 0.5);
    const iqr = Math.max(q3 - q1, 0.04);
    const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    const mad = Math.max(wQuantile(lv.map((x) => ({ v: Math.abs(x.v - med), w: 1 })), 0.5), 0.02);
    cands = cands.filter((c) => {
      const x = Math.log(c.adjusted);
      const mz = (0.6745 * (x - med)) / mad;
      const out = x < lo || x > hi || Math.abs(mz) > 3.5;
      if (out) rej("aykiri_deger");
      return !out;
    });
  } else if (cands.length >= 2) {
    const med = wQuantile(cands.map((c) => ({ v: c.adjusted, w: 1 })), 0.5);
    cands = cands.filter((c) => {
      const out = c.adjusted < med * 0.45 || c.adjusted > med * 2.2;
      if (out) rej("aykiri_deger");
      return !out;
    });
  }

  // 6) ağırlık
  const medQuick = cands.length ? wQuantile(cands.map((c) => ({ v: c.adjusted, w: 1 })), 0.5) : undefined;
  const used: UsedListing[] = cands.map((c) => {
    const quality = scoreListingQuality(c.raw, now, medQuick);
    const rec = c.age == null ? 0.5 : Math.max(CFG.recencyFloor, Math.pow(0.5, c.age / CFG.halfLifeDays));
    const trust = CFG.sourceTrust[c.raw.source] ?? CFG.defaultSourceTrust;
    const w = Math.max(0.02, (quality.score / 100) * rec * trust * c.comp);
    return { id: c.id, source: c.raw.source, url: c.raw.url, title: c.raw.title, price: c.price, adjustedPrice: Math.round(c.adjusted), weight: w, quality, ageDays: c.age };
  });

  const wsum = used.reduce((s, u) => s + u.weight, 0);
  const w2 = used.reduce((s, u) => s + u.weight * u.weight, 0);
  const neff = used.length ? (wsum * wsum) / w2 : 0; // Kish etkin örneklem
  const items = used.map((u) => ({ v: u.adjustedPrice, w: u.weight }));
  const sources = [...new Set(used.map((u) => u.source))];

  // 7) canlı istatistik
  let live: { p10: number; p25: number; median: number; p75: number; p90: number } | null = null;
  let ci: [number, number] | null = null;
  if (used.length >= 3) {
    live = {
      p10: wQuantile(items, 0.1), p25: wQuantile(items, 0.25), median: wQuantile(items, 0.5),
      p75: wQuantile(items, 0.75), p90: wQuantile(items, 0.9),
    };
    const rnd = mulberry32(items.length * 7919 + Math.round(live.median));
    const meds: number[] = [];
    const sorted = [...items].sort((a, b) => a.v - b.v);
    const cw: number[] = [];
    sorted.reduce((s, i) => (cw.push(s + i.w), s + i.w), 0);
    for (let b = 0; b < CFG.bootstrapRuns; b++) {
      const sample: { v: number; w: number }[] = [];
      for (let k = 0; k < sorted.length; k++) {
        const r = rnd() * wsum;
        let idx = cw.findIndex((x) => x >= r);
        if (idx < 0) idx = sorted.length - 1;
        sample.push({ v: sorted[idx].v, w: 1 });
      }
      meds.push(wQuantile(sample, 0.5));
    }
    meds.sort((a, b) => a - b);
    ci = [roundTRY(meds[Math.floor(meds.length * 0.1)]), roundTRY(meds[Math.floor(meds.length * 0.9)])];
  }

  // 8) önsel harmanı
  let priorShare = 0;
  let range = live;
  const prior = q.prior;
  if (prior) {
    const pr = { p10: prior.min * 0.92, p25: prior.min, median: prior.median, p75: prior.max, p90: prior.max * 1.08 };
    if (!live) { range = pr; priorShare = 1; }
    else {
      priorShare = CFG.priorStrength / (CFG.priorStrength + neff);
      const mix = (a: number, b: number) => (1 - priorShare) * a + priorShare * b;
      range = { p10: mix(live.p10, pr.p10), p25: mix(live.p25, pr.p25), median: mix(live.median, pr.median), p75: mix(live.p75, pr.p75), p90: mix(live.p90, pr.p90) };
    }
  }

  const empty: MarketResult = {
    status: "no_data", range: null, medianCI80: null, confidence: { score: 0, label: "dusuk" },
    sample: { received: listings.length, used: 0, effective: 0, sources: [], priorShare: 0 },
    rejected, verdict: null, negotiation: null, subjectQuality: q.subject ? scoreListingQuality(q.subject, now) : null,
    topComparables: [], warnings: ["Karşılaştırılabilir ilan ve önsel fiyat yok; karar verilemez."],
  };
  if (!range) return empty;

  const R = {
    p10: roundTRY(range.p10), p25: roundTRY(range.p25), median: roundTRY(range.median),
    p75: roundTRY(range.p75), p90: roundTRY(range.p90),
  };

  // güven
  const disp = (R.p75 - R.p25) / R.median;
  const avgRec = used.length ? used.reduce((s, u) => s + (u.ageDays == null ? 0.5 : Math.pow(0.5, u.ageDays / CFG.halfLifeDays)), 0) / used.length : 0;
  const avgQ = used.length ? used.reduce((s, u) => s + u.quality.score, 0) / used.length / 100 : 0;
  let cs = clamp(neff / 12, 0, 1) * 40 + clamp(1 - disp / 0.5, 0, 1) * 25 + avgRec * 15 + (Math.min(sources.length, 3) / 3) * 10 + avgQ * 10;
  if (!live) cs = Math.min(cs, 35);
  const confScore = Math.round(clamp(cs, 0, 100));
  const confLabel = confScore >= 75 ? "yuksek" : confScore >= 50 ? "orta" : "dusuk";

  const status: MarketResult["status"] = !live ? "prior_only" : used.length >= CFG.minUsedForOk ? "ok" : "low_data";
  if (status === "prior_only") warnings.push("Canlı ilan verisi yok; yalnızca statik fiyat tablosu kullanıldı. Güven düşük.");
  if (status === "low_data") warnings.push(`Az sayıda uygun ilan (${used.length}); aralık geniş ve belirsiz olabilir.`);
  if (disp > 0.45) warnings.push("Fiyatlar çok dağınık; kondisyon/depolama farkları kararı etkiler.");
  if (live && avgRec < 0.3) warnings.push("İlanların çoğu eski; güncel piyasa farklı olabilir.");

  // 9) karar
  const price = parsePriceTRY(q.listingPrice ?? q.subject?.price);
  let verdict: MarketResult["verdict"] = null;
  let negotiation: MarketResult["negotiation"] = null;
  if (price) {
    const ratio = price / R.median;
    const pts: [number, number][] = [[R.p10, 10], [R.p25, 25], [R.median, 50], [R.p75, 75], [R.p90, 90]];
    let pct: number;
    if (price <= pts[0][0]) pct = ratio < 0.8 ? 2 : 5;
    else if (price >= pts[4][0]) pct = ratio > 1.3 ? 99 : 95;
    else {
      pct = 50;
      for (let i = 0; i < 4; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (price >= x0 && price <= x1) { pct = y0 + ((price - x0) / (x1 - x0 || 1)) * (y1 - y0); break; }
      }
    }
    pct = Math.round(pct);
    const delta = Math.round((ratio - 1) * 1000) / 10;
    let v: Verdict, msg: string;
    if (ratio < 0.6) { v = "supheli_ucuz"; msg = "Piyasanın çok altında. Gizli arıza, kilitli cihaz veya dolandırıcılık riski yüksek; elden kontrol şart."; }
    else if (pct <= 25) { v = "firsat"; msg = "Benzer ilanların en ucuz çeyreğinde. İyi fiyat, cihazı yine de elden kontrol et."; }
    else if (pct <= 60) { v = "makul"; msg = "Piyasa aralığının ortasında; adil fiyat. Küçük pazarlık payı olabilir."; }
    else if (pct <= 80) { v = "biraz_pahali"; msg = "Medyanın üzerinde. Pazarlık yapmadan alma."; }
    else { v = "pahali"; msg = "Benzer ilanların pahalı tarafında. Daha uygun alternatifler var."; }
    verdict = { verdict: v, percentile: pct, deltaVsMedianPct: delta, message: msg };

    const opening = price <= R.p25 ? price * 0.95 : clamp(R.p25, price * 0.8, price);
    negotiation = { opening: roundTRY(opening), fair: R.median, walkAway: roundTRY(Math.min(price, Math.max(R.p75, R.median))) };
  }

  const top = [...used].sort((a, b) => b.weight - a.weight).slice(0, 8);
  return {
    status, range: R, medianCI80: ci, confidence: { score: confScore, label: confLabel },
    sample: { received: listings.length, used: used.length, effective: Math.round(neff * 10) / 10, sources, priorShare: Math.round(priorShare * 100) / 100 },
    rejected, verdict, negotiation, subjectQuality: q.subject ? scoreListingQuality(q.subject, now, R.median) : null,
    topComparables: top, warnings,
  };
}