// src/app/api/ekspertiz/route.ts
// Ekspertiz hattı: (1) Google Search ile ilan/link analizi, (2) JSON çıkarım, (3) kodla değerleme ve karar,
// (4) yapay zeka ile mühendislik düzeyinde teknik rapor. Sayıların, kararın ve rozetin tamamı KODDA hesaplanır.
// Yeterli gerçek ilan yoksa sahte veri üretilmez; piyasa aralığı boş kalır veya "tahmini" olarak işaretlenir.

import { NextResponse } from "next/server";
import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import {
  valuate,
  judge,
  type CompListing,
  type Decision,
  type DeviceInfo,
  type PriceRange,
  type UsedComp,
} from "@/lib/valuation";
import { parseEkspertizInput } from "@/lib/ekspertizInput";
import { analyzeFraudRisk } from "@/lib/fraudDetection";
import { safeRun } from "@/lib/safeRun";
import type {
  AlternativeListing,
  AlternativesStatus,
  DeliveryType,
  DeviationBand,
  EkspertizCondition,
  EkspertizReport,
  PlatformStat,
  PriceDeviation,
  SourceLink,
  TechItem,
  TechStatus,
} from "@/types/ekspertiz";

// ---------------------------------------------------------------------------
// Sabitler ve Süreç Zaman Sınırları
// ---------------------------------------------------------------------------

const SEARCH_DEADLINE_MS = 40_000;
const EXTRACT_DEADLINE_MS = 55_000;
const REPORT_DEADLINE_MS = 88_000;
const MIN_STAGE_MS = 3_000;

const COMPS_CACHE_TTL_MS = 30 * 60_000;
const COMPS_CACHE_MAX = 60;

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = Number(process.env.ANALYZE_RATE_LIMIT || 12);

/** Piyasa alt sınırının bu oranının altındaki ilanlar "avantajlı alternatif" olarak önerilmez (şüpheli derecede ucuz). */
const SUSPICIOUS_LOW_RATIO = 0.75;
const MAX_ALTERNATIVES = 4;

/** Çıkarılan ilana, ilanda açıkça yazıyorsa eklenen ek bilgiler. */
interface EnrichedComp extends CompListing {
  sellerTrust: number | null;
  delivery: DeliveryType | null;
}

interface CompExtras {
  sellerTrust: number | null;
  delivery: DeliveryType | null;
}

interface AiText {
  brand: string | null;
  series: string | null;
  releaseYear: number | null;
  summary: string;
  technicalComments: string;
  technicalItems: TechItem[];
  strengths: string[];
  riskAnalysis: string[];
  missingData: string[];
  checklist: string[];
  tactics: string[];
  imageFindings: string[];
  estimatedRange: { min: number; max: number } | null;
}

type GenContents =
  | string
  | Array<{
      role: string;
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }>;

interface CallResult {
  text: string;
  model: string;
  usedFallback: boolean;
  sourceLinks: SourceLink[];
}

type ErrKind = "quota" | "overloaded" | "notfound" | "timeout" | "auth" | "other";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Bellek İçi Önbellek ve İstek Sınırı (Rate Limiting)
// ---------------------------------------------------------------------------

interface CompsEntry {
  comps: EnrichedComp[];
  sourceLinks: SourceLink[];
  groundingCount: number;
  at: number;
}

const compsCache = new Map<string, CompsEntry>();
const rateHits = new Map<string, number[]>();

function getCachedComps(key: string): CompsEntry | null {
  const e = compsCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > COMPS_CACHE_TTL_MS) {
    compsCache.delete(key);
    return null;
  }
  return e;
}

function setCachedComps(key: string, entry: CompsEntry): void {
  if (compsCache.size >= COMPS_CACHE_MAX) {
    const oldest = compsCache.keys().next().value;
    if (oldest !== undefined) compsCache.delete(oldest);
  }
  compsCache.set(key, entry);
}

function isRateLimited(ip: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const now = Date.now();
  const recent = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(ip, recent);
  if (rateHits.size > 2000) rateHits.clear();
  return false;
}

// ---------------------------------------------------------------------------
// Metin ve Veri Temizleme Yardımcıları
// ---------------------------------------------------------------------------

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

function str(x: unknown, max: number): string {
  return typeof x === "string" ? cleanBlock(x, max) : "";
}

function strArr(x: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(x)) return [];
  const out: string[] = [];
  for (const v of x) {
    const s = str(v, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function uniqueByPrefix(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 28);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

function fmtPct(n: number): string {
  return String(Math.abs(n)).replace(".", ",");
}

function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

/** (price - ref) / ref yüzdesi, bir ondalık. ref geçersizse null. */
function pctDiff(price: number, ref: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(ref) || ref <= 0) return null;
  return Math.round(((price - ref) / ref) * 1000) / 10;
}

function bandOf(dev: number | null): DeviationBand | null {
  if (dev === null) return null;
  if (dev <= -20) return "much_below";
  if (dev < -5) return "below";
  if (dev <= 5) return "near";
  if (dev < 20) return "above";
  return "much_above";
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  let start = -1;
  let endChar = "}";
  if (firstObj === -1 && firstArr === -1) return null;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    endChar = "]";
  } else {
    start = firstObj;
  }
  const end = cleaned.lastIndexOf(endChar);
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function urlKey(u: string): string {
  return u.toLowerCase().split("?")[0].split("#")[0].replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Cihaz Bilgisi Türetme
// ---------------------------------------------------------------------------

function deriveStorage(model: string): string {
  const m = model.match(/(\d{2,4})\s?(gb|tb)/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : "";
}

function deriveCondition(tags: string[]): EkspertizCondition {
  const has = (t: string) => tags.includes(t);
  if (has("Çizikler Var")) return "fair";
  const scratched = has("Ufak Çizikler Var");
  if (!scratched && !has("Pil Değişmiş") && has("Değişensiz / Orijinal") && has("Pil %85+") && has("Face ID / True Tone Aktif")) {
    return "like_new";
  }
  return "good";
}

const COND_LABEL: Record<EkspertizCondition, string> = {
  like_new: "Çok iyi (sıfır ayarında)",
  good: "İyi",
  fair: "Orta (belirgin çizik)",
  poor: "Zayıf",
};

// ---------------------------------------------------------------------------
// Gemini AI İstek Yönetimi ve Hata Toleransı
// ---------------------------------------------------------------------------

function classify(err: unknown): ErrKind {
  const e = err as { status?: unknown; code?: unknown; message?: unknown } | null;
  const msg = String(e?.message ?? "").toLowerCase();
  const status = Number(e?.status ?? e?.code);
  if (msg === "timeout") return "timeout";
  if (status === 429 || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota")) return "quota";
  if (status === 503 || msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded")) return "overloaded";
  if (status === 404 || msg.includes("404") || msg.includes("not_found") || msg.includes("not found")) return "notfound";
  if (status === 401 || status === 403 || msg.includes("api key") || msg.includes("permission_denied")) return "auth";
  return "other";
}

function toHttpError(kind: ErrKind): HttpError {
  switch (kind) {
    case "quota":
      return new HttpError(429, "Yapay zeka günlük kullanım kotası doldu. Lütfen birkaç dakika sonra tekrar deneyin.");
    case "overloaded":
      return new HttpError(503, "Yapay zeka servisi şu an yoğun. Lütfen kısa süre sonra tekrar deneyin.");
    case "notfound":
      return new HttpError(502, "Yapay zeka model yapılandırma hatası.");
    case "auth":
      return new HttpError(500, "Yapay zeka kimlik doğrulama hatası.");
    case "timeout":
      return new HttpError(504, "Analiz zaman sınırını aştı. Lütfen tekrar deneyin.");
    default:
      return new HttpError(500, "Analiz gerçekleştirilemedi. Lütfen tekrar deneyin.");
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Arama sonucu bağlantıları çoğunlukla yönlendirme adresidir; bu durumda sayfa başlığı (alan adı) tercih edilir. */
function sourceName(link: SourceLink): string {
  const host = hostOf(link.uri);
  const isRedirect = host.includes("vertexaisearch") || host.endsWith("google.com");
  if (isRedirect && link.title) return link.title;
  return host || link.title;
}

async function callGemini(
  ai: GoogleGenAI,
  models: string[],
  contents: GenContents,
  config: GenerateContentConfig,
  startedAt: number,
  deadlineMs: number
): Promise<CallResult> {
  const list = Array.from(new Set(models.filter(Boolean)));
  let lastKind: ErrKind = "other";

  for (let i = 0; i < list.length; i++) {
    const model = list[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = startedAt + deadlineMs - Date.now();
      if (remaining < MIN_STAGE_MS) throw toHttpError("timeout");

      try {
        const resp = await withTimeout(ai.models.generateContent({ model, contents, config }), remaining);
        const chunks = resp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const links: SourceLink[] = [];
        for (const c of chunks) {
          const uri = c.web?.uri;
          if (!uri) continue;
          links.push({ title: cleanLine(c.web?.title || hostOf(uri) || "Kaynak", 80), uri });
        }
        return { text: resp.text ?? "", model, usedFallback: i > 0, sourceLinks: links };
      } catch (err) {
        const kind = classify(err);
        lastKind = kind;
        console.error(`[ekspertiz] ${model} hata (${kind}):`, err instanceof Error ? err.message : err);
        if (kind === "overloaded" && attempt === 0) {
          await sleep(800);
          continue;
        }
        if (kind === "timeout" || kind === "auth" || kind === "other") throw toHttpError(kind);
        break;
      }
    }
  }
  throw toHttpError(lastKind);
}

// ---------------------------------------------------------------------------
// Pazar Taraması, Link Analizi ve Veri Yapılandırma
// ---------------------------------------------------------------------------

const LISTING_LINE_FORMAT = "- [Kaynak] Başlık | Fiyat TL | Tarih | Bağlantı | Satıcı puanı | Teslimat";
const LISTING_EXTRA_RULES = `- Satıcı puanı ve teslimat türü (kargo / elden / ikisi) bilgisini YALNIZCA ilanda ya da arama sonucunda açıkça yazıyorsa ver. Yazmıyorsa "yok" yaz. Tahmin etme, uydurma.
- Bağlantı yoksa "yok" yaz. Bağlantıyı asla uydurma.`;

function buildSearchPrompt(model: string, sellerNote: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const isUrl = sellerNote && (sellerNote.startsWith("http://") || sellerNote.startsWith("https://") || sellerNote.includes(".com"));

  if (isUrl) {
    return `Bugünün tarihi ${today}. Kullanıcının belirttiği şu ilan bağlantısını ve içeriğini Google Search ile derinlemesine incele: "${sellerNote}"
Ayrıca Türkiye'deki ikinci el pazarında "${model}" için güncel ilanları ve fiyat medyanını araştır.
Kurallar:
- İlanın detaylarını, fiyatını ve içerik bağlamını tam olarak analiz et.
- Cevabın ilk satırı tam olarak "İLANLAR:" olsun, altında ilgili ilanlar için tek satır yer alsın.
- Satır formatı: ${LISTING_LINE_FORMAT}
${LISTING_EXTRA_RULES}
- En fazla 15 satır döndür.`;
  }

  return `Bugünün tarihi ${today}. Türkiye'deki ikinci el pazarında şu cihaz için güncel ilanları Google Search ile ara: "${model}".
Ek Satıcı Notu/Açıklaması: "${sellerNote}"
Kurallar:
- Sadece gerçek ve güncel ilanları listele. Uydurma veri ekleme.
- Aksesuar, kılıf, yedek parça ve sıfır ürünleri ele.
- Cevabın ilk satırı tam olarak "İLANLAR:" olsun, altında her ilan için tek satır yer alsın.
- Satır formatı: ${LISTING_LINE_FORMAT}
${LISTING_EXTRA_RULES}
- En fazla 15 satır döndür.`;
}

function buildExtractPrompt(model: string, raw: string): string {
  return `Aşağıdaki ham metinden ve web arama sonuçlarından "${model}" için ikinci el ilanlarını ayıkla ve saf JSON dizisi olarak döndür.
Kurallar:
- Sadece geçerli ilanları al, uydurma fiyat ekleme.
- Fiyat TL cinsinden tam sayı olsun.
- "condition" yalnızca "like_new", "good", "fair" veya "poor" olabilir.
- "sellerTrust": satıcı puanı metinde açıkça yazıyorsa 0-100 aralığına çevirilmiş sayı (örn. 5 üzerinden 4.8 ise 96), yazmıyorsa null. Tahmin etme.
- "delivery": yalnızca "kargo", "elden" veya "ikisi"; metinde açıkça yazmıyorsa null. Tahmin etme.
- "url": yalnızca metinde gerçekten yazan tam bağlantı, yoksa null. Bağlantı uydurma.
- Çıktı yalnızca saf JSON dizisi olsun: [{"title":"","price":0,"source":"","condition":"good","date":null,"url":null,"sellerTrust":null,"delivery":null}]

HAM METİN:
${raw.slice(0, 12000)}`;
}

function normCondition(x: unknown): string | undefined {
  return x === "like_new" || x === "good" || x === "fair" || x === "poor" ? x : undefined;
}

function normDelivery(x: unknown): DeliveryType | null {
  return x === "kargo" || x === "elden" || x === "ikisi" ? x : null;
}

function normTrust(x: unknown): number | null {
  let n = NaN;
  if (typeof x === "number") {
    n = x;
  } else if (typeof x === "string" && /^\d{1,3}([.,]\d+)?$/.test(x.trim())) {
    n = Number(x.trim().replace(",", "."));
  }
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

function toComps(parsed: unknown): EnrichedComp[] {
  if (!Array.isArray(parsed)) return [];
  const out: EnrichedComp[] = [];
  for (const it of parsed) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const title = str(o.title, 160);
    const source = str(o.source, 40) || "Bilinmiyor";
    let price = typeof o.price === "number" ? o.price : Number(String(o.price ?? "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(price)) continue;
    price = Math.round(price);
    if (!title || price <= 0) continue;
    const comp: EnrichedComp = {
      title,
      price,
      source,
      condition: normCondition(o.condition),
      sellerTrust: normTrust(o.sellerTrust),
      delivery: normDelivery(o.delivery),
    };
    if (typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date)) comp.date = o.date;
    if (typeof o.url === "string" && /^https?:\/\//.test(o.url)) comp.url = o.url.slice(0, 300);
    out.push(comp);
    if (out.length >= 40) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Alternatif Seçimi: yalnızca gerçek, bağlantılı ve ilan fiyatından ucuz ilanlar
// ---------------------------------------------------------------------------

function buildReason(args: {
  savingsTL: number;
  savingsPct: number;
  vsMedianPct: number | null;
  sellerTrust: number | null;
  delivery: DeliveryType | null;
  grounded: boolean;
}): string {
  const parts: string[] = [`Mevcut ilandan ${fmtMoney(args.savingsTL)} (%${fmtPct(args.savingsPct)}) daha ucuz`];
  if (args.vsMedianPct !== null) {
    parts.push(
      args.vsMedianPct <= 0
        ? `piyasa medyanının %${fmtPct(args.vsMedianPct)} altında`
        : `piyasa medyanının %${fmtPct(args.vsMedianPct)} üstünde`
    );
  }
  if (args.sellerTrust !== null) parts.push(`ilanda belirtilen satıcı puanı ${args.sellerTrust}/100`);
  if (args.delivery === "elden") parts.push("elden teslim seçeneği var");
  if (args.delivery === "ikisi") parts.push("elden teslim ve kargo seçeneği var");
  if (args.delivery === "kargo") parts.push("yalnızca kargo, ödemeden önce cihaz test edilemez");
  if (!args.grounded) parts.push("bağlantının alan adı arama sonuçlarında doğrulanamadı, ilanı açıp kontrol edin");
  return parts.join("; ") + ".";
}

function pickAlternatives(args: {
  usedComps: UsedComp[];
  listingPrice: number;
  market: PriceRange;
  extras: Map<string, CompExtras>;
  isGrounded: (url: string) => boolean;
}): AlternativeListing[] {
  const floor = args.market.min * SUSPICIOUS_LOW_RATIO;
  const seen = new Set<string>();
  const out: AlternativeListing[] = [];

  for (const c of args.usedComps) {
    if (!c.url || !/^https?:\/\//.test(c.url)) continue;
    if (c.price >= args.listingPrice) continue;
    if (c.price < floor) continue;
    const key = urlKey(c.url);
    if (seen.has(key)) continue;
    seen.add(key);

    const extra = args.extras.get(key);
    const sellerTrust = extra?.sellerTrust ?? null;
    const delivery = extra?.delivery ?? null;
    const grounded = args.isGrounded(c.url);
    const savingsTL = args.listingPrice - c.price;
    const savingsPct = pctDiff(args.listingPrice, c.price) === null ? 0 : Math.round((savingsTL / args.listingPrice) * 1000) / 10;

    out.push({
      title: c.title,
      price: c.price,
      source: c.source,
      url: c.url,
      urlGrounded: grounded,
      savingsTL,
      savingsPct,
      sellerTrust,
      delivery,
      reason: buildReason({
        savingsTL,
        savingsPct,
        vsMedianPct: pctDiff(c.price, args.market.median),
        sellerTrust,
        delivery,
        grounded,
      }),
      searchQuery: `${c.source} ${c.title}`.slice(0, 120),
    });
  }

  out.sort((a, b) => a.price - b.price || (b.sellerTrust ?? -1) - (a.sellerTrust ?? -1));
  return out.slice(0, MAX_ALTERNATIVES);
}

// ---------------------------------------------------------------------------
// Borsa ve Mühendislik Düzeyinde Rapor Sistemi
// ---------------------------------------------------------------------------

const REPORT_SYSTEM = `Sen Türkiye ikinci el cep telefonu piyasasını kusursuz bilen kıdemli bir donanım mühendisi, siber güvenlik uzmanı ve borsa analistisin.
Kurallar:
- Yalnızca Türkçe ve saf JSON döndür (markdown blokları kullanma).
- Mühendislik ve pazar likiditesi diliyle, son derece profesyonel ve teknik açıklamalar yap.
- Pil döngü ömrü, OLED piksel yıpranması, silikon performansı, link içeriği ve pazar rasyolarını detaylı açıkla.
- Verilen sayıları ve kararları ASLA değiştirme.`;

function buildReportPrompt(args: {
  model: string;
  storage: string;
  listingPrice: number;
  condLabel: string;
  tags: string[];
  sellerNote: string;
  hasImage: boolean;
  decision: string;
  verdict: string;
  market: PriceRange | null;
  usedCount: number;
  confidence: number;
  estimateMode: boolean;
}): string {
  const facts = {
    cihaz: args.model,
    depolama: args.storage || "belirtilmedi",
    ilan_fiyati_TL: args.listingPrice,
    kondisyon_beyani: args.condLabel,
    secilen_ozellikler: args.tags,
    karar: args.decision,
    fiyat_degerlendirmesi: args.verdict,
    piyasa_araligi_TL: args.market ? { alt: args.market.min, medyan: args.market.median, ust: args.market.max } : null,
    kullanilan_ilan_sayisi: args.usedCount,
    guven_puani: args.confidence,
    tahmin_modu: args.estimateMode,
  };

  return `Aşağıdaki doğrulanmış verilere göre ekspertiz raporunun ileri düzey teknik metinlerini üret.

VERİLER (JSON):
${JSON.stringify(facts)}

<satici_notu_veya_link>
${args.sellerNote || "Belirtilmemiş"}
</satici_notu_veya_link>

Şu JSON nesnesini döndür:
{
  "brand": "marka",
  "series": "model ailesi",
  "releaseYear": 2023,
  "summary": "Cihazın makro piyasa konumu, talep esnekliği, link/ilan detayları ve enflasyonist değer kaybı özeti (3-4 cümle)",
  "technicalComments": "İşlemci mimarisi, batarya kimyasası, ekran paneli aşınması, link içeriğindeki riskler ve onarım potansiyeli hakkında derinlemesine teknik analiz (2-3 paragraf)",
  "technicalItems": [{"area":"İşlemci / Silikon","finding":"...","status":"doğrulandı|tahmini|bulunamadı"}],
  "strengths": ["Bu cihaza, ilana ve link içeriğine özgü avantajlar, max 4 madde"],
  "riskAnalysis": ["Bu modele ve paylaşılan nota/linke özgü somut mühendislik ve piyasa riskleri, 4-6 madde"],
  "missingData": ["Karar için eksik olan kritik bilgiler, max 5 madde"],
  "checklist": ["Bu modele ve donanıma özgü elden kontrol maddeleri, max 6 madde"],
  "tactics": ["Piyasa medyanına dayalı profesyonel pazarlık taktikleri, max 3 madde"],
  "imageFindings": [],
  "estimatedRange": ${args.estimateMode ? '{"min": 0, "max": 0}' : "null"}
}
"technicalItems" için 6-8 teknik alan ver (Örn: İşlemci, OLED Ekran, Pil Kimliği, Kamera Optiği, Şebeke/Modem, Kasa Dayanıklılığı).`;
}

function toTechStatus(x: unknown): TechStatus {
  return x === "doğrulandı" || x === "tahmini" || x === "bulunamadı" ? x : "tahmini";
}

function toAiText(parsed: unknown, estimateMode: boolean): AiText | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  const items: TechItem[] = [];
  if (Array.isArray(o.technicalItems)) {
    for (const it of o.technicalItems) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const area = str(r.area, 40);
      const finding = str(r.finding, 300);
      if (area && finding) items.push({ area, finding, status: toTechStatus(r.status) });
      if (items.length >= 10) break;
    }
  }

  let range: AiText["estimatedRange"] = null;
  if (estimateMode && o.estimatedRange && typeof o.estimatedRange === "object") {
    const r = o.estimatedRange as Record<string, unknown>;
    const min = Number(r.min);
    const max = Number(r.max);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 1000 && max > min && max <= min * 3) {
      range = { min: round100(min), max: round100(max) };
    }
  }

  const year = Number(o.releaseYear);
  return {
    brand: str(o.brand, 40) || null,
    series: str(o.series, 60) || null,
    releaseYear: Number.isInteger(year) && year >= 2007 && year <= 2030 ? year : null,
    summary: str(o.summary, 900),
    technicalComments: str(o.technicalComments, 2500),
    technicalItems: items,
    strengths: strArr(o.strengths, 4, 220),
    riskAnalysis: strArr(o.riskAnalysis, 6, 300),
    missingData: strArr(o.missingData, 5, 220),
    checklist: strArr(o.checklist, 6, 220),
    tactics: strArr(o.tactics, 3, 260),
    imageFindings: strArr(o.imageFindings, 6, 220),
    estimatedRange: range,
  };
}

// ---------------------------------------------------------------------------
// Standart Kontrol Listesi ve Uyarılar
// ---------------------------------------------------------------------------

const BASE_CHECKLIST: string[] = [
  "IMEI numarasını (*#06#) ayarlardaki ve kutudaki IMEI ile karşılaştırın, e-Devlet üzerinden resmi kayıt durumunu doğrulayın.",
  "Apple Kimliği, iCloud ve Google hesaplarının cihazdan tamamen kaldırıldığından emin olun, satıcı önünüzde sıfırlasın.",
  "Pil sağlığı yüzdesini ve şarj döngüsünü kontrol edin; cihazın normal kullanımda aşırı ısınıp ısınmadığını gözlemleyin.",
  "OLED/AMOLED ekranda piksel yanığı, hayalet ekran veya renk sapması olup olmadığını beyaz arka planda test edin.",
  "Ön/arka kamera optiklerini, OIS (görüntü sabitleme) mekanizmasını, True Tone ve Face ID / Parmak izi sensörlerini test edin.",
  "Kendi SIM kartınızı takarak 4.5G/5G şebeke kalitesini, mikrofon ve hoparlör ses netliğini test edin.",
  "Kasa vidalarında, ekran contalarında ve bağlantı noktalarında yetkisiz servis müdahalesi olup olmadığını inceleyin.",
];

const TAG_STRENGTHS: Record<string, string> = {
  "Kutulu & Faturalı": "Orijinal kutu ve faturanın mevcudiyeti cihazın yasal kaynağını ve ikinci el likiditesini doğrudan destekler.",
  "Garantisi Var": "Üretici veya ithalatçı garantisinin devam etmesi donanım arıza riskini minimize eder.",
  "Pil %85+": "Batarya kimyasal kapasitesinin yüksek olması yakın zamanda pil değişim maliyeti oluşturmayacağını gösterir.",
  "Değişensiz / Orijinal": "Parça değişimi olmaması fabrika toleranslarının korunduğunu doğrular.",
  "Face ID / True Tone Aktif": "Biyometrik sensörlerin ve ekran renk kalibrasyonunun aktif olduğu belirtilmiştir.",
};

// Yedek kontrol: fraud motoru hata verirse kullanılır.
function sellerNoteWarnings(note: string): string[] {
  const t = note.toLowerCase();
  const out: string[] = [];
  if (/kapora|iban|havale|\beft\b|ön ?ödeme/.test(t)) {
    out.push("İlan açıklamasında/notunda kapora veya ön ödeme talebi yer almaktadır. Cihazı fiziki olarak test etmeden kesinlikle para göndermeyin.");
  }
  if (/kargo/.test(t)) {
    out.push("Kargo ile gönderim teklifleri dolandırıcılık riski barındırabilir. Yüz yüze elden teslimatı tercih edin.");
  }
  if (/acil|bugün|son fiyat|hemen/.test(t)) {
    out.push("Satıcının aceleci tutumu psikolojik baskı yaratabilir. Tedbiri elden bırakmayın.");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ana API İşleyicisi
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, "GEMINI_API_KEY yapılandırılmamış. Lütfen .env.local dosyanızı kontrol edin.");
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "bilinmiyor";
    if (isRateLimited(ip)) {
      throw new HttpError(429, "Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.");
    }

    const body: unknown = await req.json().catch(() => null);
    const parsedInput = parseEkspertizInput(body);
    if (!parsedInput.ok) throw new HttpError(400, parsedInput.error);
    const input = parsedInput.data;

    const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
    const searchModel = process.env.GEMINI_SEARCH_MODEL || primary;
    const ai = new GoogleGenAI({ apiKey });

    const storage = deriveStorage(input.model);
    const condition = deriveCondition(input.tags);
    const hasBox = input.tags.includes("Kutulu & Faturalı");
    const hasWarranty = input.tags.includes("Garantisi Var");

    const warnings: string[] = [];
    if (input.imageRejected) {
      warnings.push("Yüklenen görsel geçerli bir JPEG, PNG veya WebP olarak doğrulanamadığı için analize katılmadı.");
    }
    let usedFallback = false;
    const modelsUsed: string[] = [];

    // ---- Adım 1 & 2: Pazar Taraması ve Link Analizi (Önbellek Kontrollü) ----
    const cacheKey = `${input.model.toLowerCase().replace(/\s+/g, " ")}|${storage}`;
    let comps: EnrichedComp[] = [];
    let sourceLinks: SourceLink[] = [];
    let groundingCount = 0;
    let compsFromCache = false;

    // Eğer kullanıcı link veya özel not girdiyse önbelleği bypass edip taze arama yapalım
    const hasLinkOrNote = input.sellerNote && (input.sellerNote.includes("http") || input.sellerNote.length > 10);
    const cached = hasLinkOrNote ? null : getCachedComps(cacheKey);

    if (cached) {
      comps = cached.comps;
      sourceLinks = cached.sourceLinks;
      groundingCount = cached.groundingCount;
      compsFromCache = true;
    } else {
      let searchOk = false;
      try {
        const search = await callGemini(
          ai,
          [searchModel, fallback],
          buildSearchPrompt(input.model, input.sellerNote),
          { tools: [{ googleSearch: {} }], temperature: 0.1 },
          startedAt,
          SEARCH_DEADLINE_MS
        );
        modelsUsed.push(search.model);
        usedFallback = usedFallback || search.usedFallback;
        sourceLinks = search.sourceLinks;
        groundingCount = search.sourceLinks.length;
        searchOk = true;

        const hasListingLines = /İLANLAR/i.test(search.text) && /\d{1,3}[.\s]?\d{3}/.test(search.text);
        if (hasListingLines) {
          const extract = await callGemini(
            ai,
            [primary, fallback],
            buildExtractPrompt(input.model, search.text),
            { responseMimeType: "application/json", temperature: 0 },
            startedAt,
            EXTRACT_DEADLINE_MS
          );
          modelsUsed.push(extract.model);
          usedFallback = usedFallback || extract.usedFallback;
          comps = toComps(extractJson(extract.text));
        }
      } catch (err) {
        console.error("[ekspertiz] pazar/link tarama hatası:", err instanceof Error ? err.message : err);
        warnings.push("Canlı pazar ve link taraması tamamlanamadı; piyasa aralığı canlı ilanlarla hesaplanamadı.");
      }
      if (searchOk && comps.length > 0 && !hasLinkOrNote) {
        setCachedComps(cacheKey, { comps, sourceLinks, groundingCount, at: Date.now() });
      }
    }

    // ---- Adım 3: Matematiksel Değerleme ve Karar Motoru ----
    const device: DeviceInfo = { model: input.model, storage, condition, hasBox, hasWarranty };
    const valuation = valuate(device, comps);
    const judgment = judge(input.listingPrice, valuation);
    const estimateMode = valuation.estimated;

    // Güven puanı: yeterli gerçek ilan yoksa 0 (doğrulanmış güven yok).
    let confidence = valuation.confidence;
    if (!estimateMode) {
      if (!storage) confidence = Math.max(30, confidence - 10);
      if (groundingCount === 0) confidence = Math.min(confidence, 45);
    }

    let decision: Decision = judgment.decision;
    if (estimateMode) {
      warnings.push("Yeterli canlı ilan bulunamadı; piyasa aralığı doğrulanamadı ve fiyat kararı verilemiyor.");
    } else if (groundingCount === 0) {
      warnings.push("İlan bilgileri harici web kaynaklarıyla doğrulanamadı.");
      if (decision === "buy") decision = "negotiate";
    }
    if (judgment.suspiciouslyLow) {
      warnings.push("İlan fiyatı piyasa ortalamasının çok altındadır. Dolandırıcılık veya ağır hasar riski mevcuttur.");
    }

    // ---- Dolandırıcılık denetimi (fraudDetection motoru; hata olursa eski kontrole düşer) ----
    const fraudRun = safeRun("dolandiricilik-denetimi", () =>
      analyzeFraudRisk(
        input.sellerNote,
        input.listingPrice,
        valuation.marketPrice?.min ?? input.listingPrice
      )
    );
    if (fraudRun.status === "ok" && fraudRun.data) {
      const fraud = fraudRun.data;
      if (fraud.warnings.length > 0) {
        warnings.push(`Dolandırıcılık risk seviyesi: ${fraud.riskLevel} (skor: ${fraud.riskScore}/100).`);
        warnings.push(...fraud.warnings);
      }
      if (fraud.riskScore >= 60 && decision === "buy") decision = "negotiate";
    } else {
      warnings.push(...sellerNoteWarnings(input.sellerNote));
    }

    // ---- Adım 4: İleri Düzey Mühendislik Raporu Üretimi ----
    let aiText: AiText | null = null;
    try {
      const prompt = buildReportPrompt({
        model: input.model,
        storage,
        listingPrice: input.listingPrice,
        condLabel: COND_LABEL[condition],
        tags: input.tags,
        sellerNote: input.sellerNote,
        hasImage: !!input.image,
        decision,
        verdict: judgment.verdict,
        market: valuation.marketPrice,
        usedCount: valuation.basis.usedCount,
        confidence,
        estimateMode,
      });

      const contents: GenContents = input.image
        ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: input.image.mimeType, data: input.image.data } }] }]
        : prompt;

      const report = await callGemini(
        ai,
        [primary, fallback],
        contents,
        { systemInstruction: REPORT_SYSTEM, responseMimeType: "application/json", temperature: 0.3 },
        startedAt,
        REPORT_DEADLINE_MS
      );
      modelsUsed.push(report.model);
      usedFallback = usedFallback || report.usedFallback;
      aiText = toAiText(extractJson(report.text), estimateMode);
    } catch (err) {
      console.error("[ekspertiz] rapor metin üretim hatası:", err instanceof Error ? err.message : err);
      warnings.push("Yapay zeka teknik yorumları üretilemedi, sayısal sonuçlar koddan hesaplandı.");
    }

    // ---- Piyasa aralığı: gerçek ilanlardan ya da (yoksa) yapay zeka tahmininden ----
    let marketPrice: PriceRange | null = valuation.marketPrice;
    let marketPriceIsEstimate = false;
    if (!marketPrice && aiText?.estimatedRange) {
      const { min, max } = aiText.estimatedRange;
      marketPrice = { min, max, median: round100((min + max) / 2), currency: "TL" };
      marketPriceIsEstimate = true;
      warnings.push("Gösterilen piyasa aralığı yapay zeka tahminidir; canlı ilanlarla doğrulanmamıştır.");
    }

    let targetOffer = judgment.suggestedOffer;
    let walkAwayPrice = judgment.walkAwayPrice;
    if (marketPriceIsEstimate && marketPrice) {
      targetOffer = round100(Math.min(marketPrice.median * 0.96, input.listingPrice * 0.97));
      walkAwayPrice = Math.max(marketPrice.max, targetOffer);
    }

    // ---- Sapma matrisi: yalnızca gerçek ilanlardan hesaplanan aralıkla ----
    const vm = valuation.marketPrice;
    const priceDeviation: PriceDeviation = vm
      ? {
          vsMedianPct: judgment.deviationPct,
          vsMinPct: pctDiff(input.listingPrice, vm.min),
          vsMaxPct: pctDiff(input.listingPrice, vm.max),
          band: bandOf(judgment.deviationPct),
        }
      : { vsMedianPct: null, vsMinPct: null, vsMaxPct: null, band: null };

    // ---- Pazarlık taktikleri ----
    const tactics: string[] = [];
    if (vm) {
      tactics.push(`İlk teklifinizi ${fmtMoney(targetOffer)} olarak belirleyin ve ${fmtMoney(walkAwayPrice)} sınırını aşmayın.`);
      tactics.push(`Piyasa medyanı ${fmtMoney(vm.median)} seviyesindedir. Satıcı ile görüşürken bu istatistiği referans alın.`);
    } else if (marketPriceIsEstimate) {
      tactics.push(
        `Doğrulanmamış yapay zeka tahminine göre ilk teklif ${fmtMoney(targetOffer)}, üst sınır ${fmtMoney(walkAwayPrice)}. Kesin piyasa referansı değildir.`
      );
    } else {
      tactics.push(
        `Doğrulanmış piyasa verisi olmadığı için teklif ilan fiyatının yaklaşık %8 altı (${fmtMoney(targetOffer)}) olarak varsayıldı. Bu bir piyasa referansı değildir; benzer ilanları elle karşılaştırın.`
      );
    }
    tactics.push(...(aiText?.tactics ?? []));

    const strengths = uniqueByPrefix(
      [
        ...input.tags.map((t) => TAG_STRENGTHS[t]).filter((s): s is string => !!s),
        ...(!estimateMode && (judgment.verdict === "fair" || judgment.verdict === "great_deal") && !judgment.suspiciouslyLow
          ? ["İlan fiyatı istatistiksel adil aralıkta konumlanmıştır."]
          : []),
        ...(aiText?.strengths ?? []),
      ],
      6
    );

    const missingData = uniqueByPrefix(
      [
        ...(!storage ? ["Depolama varyantı belirtilmedi."] : []),
        ...(!input.tags.includes("Pil %85+") ? ["Batarya sağlık yüzcesi doğrulanmadı."] : []),
        ...(!input.image ? ["Cihaz görseli eklenmediği için kondisyon incelemesi sınırlı kaldı."] : []),
        ...(aiText?.missingData ?? []),
      ],
      8
    );

    const riskAnalysis = uniqueByPrefix([...warnings, ...(aiText?.riskAnalysis ?? [])], 10);
    const checklist = uniqueByPrefix([...BASE_CHECKLIST, ...(aiText?.checklist ?? [])], 14);

    // ---- Alternatifler: yalnızca gerçek, bağlantılı, ilan fiyatından ucuz ilanlar ----
    const extrasByUrl = new Map<string, CompExtras>();
    for (const c of comps) {
      if (c.url) extrasByUrl.set(urlKey(c.url), { sellerTrust: c.sellerTrust, delivery: c.delivery });
    }

    const groundedHosts = new Set<string>();
    for (const l of sourceLinks) {
      const h = hostOf(l.uri);
      if (h) groundedHosts.add(h);
      const t = l.title.toLowerCase().replace(/^www\./, "");
      if (t) groundedHosts.add(t);
    }
    const isGrounded = (url: string): boolean => {
      const h = hostOf(url);
      return h !== "" && groundedHosts.has(h);
    };

    let alternativesStatus: AlternativesStatus = "insufficient_data";
    let betterAlternatives: AlternativeListing[] = [];
    if (vm) {
      betterAlternatives = pickAlternatives({
        usedComps: valuation.basis.usedComps,
        listingPrice: input.listingPrice,
        market: vm,
        extras: extrasByUrl,
        isGrounded,
      });
      alternativesStatus = betterAlternatives.length > 0 ? "found" : "none_found";
    }
    const bestAlternative: AlternativeListing | null = betterAlternatives[0] ?? null;

    // ---- Veri dayanağı: kaynaklar ve platform dağılımı ----
    const groundedNames = sourceLinks.map(sourceName).filter(Boolean);
    const sourceKeys = new Set<string>();
    const sources: string[] = [];
    for (const name of [...valuation.basis.sources, ...groundedNames]) {
      const key = name.toLowerCase().replace(/\.(com\.tr|com|net|org)$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
      if (!key || sourceKeys.has(key)) continue;
      sourceKeys.add(key);
      sources.push(name);
      if (sources.length >= 12) break;
    }

    const platformCount = new Map<string, number>();
    for (const c of comps) platformCount.set(c.source, (platformCount.get(c.source) ?? 0) + 1);
    const platforms: PlatformStat[] = Array.from(platformCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, receivedCount]) => ({ name, receivedCount }));

    const report: EkspertizReport = {
      category: "Akıllı Telefon İleri Düzey Mühendislik Analizi",
      deviceCategory: "smartphone",
      productName: input.model,
      listingPrice: input.listingPrice,
      marketPrice,
      marketPriceIsEstimate,
      verdict: judgment.verdict,
      decision,
      suspiciouslyLow: judgment.suspiciouslyLow,
      estimated: estimateMode,
      recommendation:
        marketPriceIsEstimate && marketPrice
          ? `${judgment.message} Yapay zeka tahmini aralık (doğrulanmadı): ${fmtMoney(marketPrice.min)} - ${fmtMoney(marketPrice.max)}.`
          : judgment.message,
      confidence: estimateMode ? 0 : confidence,
      priceDeviation,
      identity: {
        brand: aiText?.brand ?? null,
        series: aiText?.series ?? null,
        releaseYear: aiText?.releaseYear ?? null,
        storage: storage || null,
        condition,
        conditionLabel: COND_LABEL[condition],
        hasBox,
        hasWarranty,
      },
      summary: aiText?.summary || "Makro piyasa ve değerleme analizi tamamlandı.",
      technicalComments: aiText?.technicalComments || "Cihazın donanım bileşenleri ve pazar likiditesi incelendi.",
      technicalItems: aiText?.technicalItems ?? [],
      hardwareMetrics: [],
      repairability: null,
      strengths,
      riskAnalysis,
      missingData,
      checklist,
      imageFindings: aiText?.imageFindings ?? [],
      warnings,
      bargainingPlan: {
        targetOffer,
        walkAwayPrice,
        tactics: tactics.slice(0, 5),
      },
      alternativesStatus,
      bestAlternative,
      betterAlternatives,
      alternatives: [],
      basis: {
        ...valuation.basis,
        sources,
        mode: estimateMode ? "estimated" : "live",
        sourceLinks: sourceLinks.slice(0, 8),
        groundedSourceCount: groundingCount,
        fromCache: compsFromCache,
        platforms,
      },
      disclaimer: "Bu rapor yapay zeka ve açık web verilerine dayanan profesyonel bir karar desteğidir.",
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      report,
      meta: { models: modelsUsed, usedFallback, elapsedMs: Date.now() - startedAt },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[ekspertiz] hata:", err);
    return NextResponse.json({ success: false, error: "Analiz şu an gerçekleştirilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}