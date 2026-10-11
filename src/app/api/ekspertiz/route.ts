// src/app/api/ekspertiz/route.ts
// Ekspertiz hattı: (1) Google Search ile ilan/link analizi, (2) JSON çıkarım, (3) kodla değerleme ve karar,
// (4) yapay zeka ile mühendislik düzeyinde teknik rapor. Sayıların, kararın ve rozetin tamamı KODDA hesaplanır.

import { NextResponse } from "next/server";
import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { valuate, judge, type CompListing, type DeviceInfo, type PriceRange } from "@/lib/valuation";

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

const MAX_IMAGE_CHARS = 7_000_000;

type Cond = "like_new" | "good" | "fair" | "poor";
type TechStatus = "doğrulandı" | "tahmini" | "bulunamadı";

interface TechItem {
  area: string;
  finding: string;
  status: TechStatus;
}

interface SourceLink {
  title: string;
  uri: string;
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
  comps: CompListing[];
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

function round100(n: number): number {
  return Math.round(n / 100) * 100;
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

// ---------------------------------------------------------------------------
// Girdi Doğrulama ve Güvenlik
// ---------------------------------------------------------------------------

interface ParsedInput {
  model: string;
  listingPrice: number;
  tags: string[];
  sellerNote: string;
  image: { mimeType: string; data: string } | null;
  imageRejected: boolean;
}

function parseImage(x: unknown): { image: ParsedInput["image"]; rejected: boolean } {
  if (typeof x !== "string" || x.length === 0) return { image: null, rejected: false };
  if (x.length > MAX_IMAGE_CHARS) return { image: null, rejected: true };
  const m = x.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (m) return { image: { mimeType: m[1], data: m[2].replace(/\s+/g, "") }, rejected: false };
  if (/^[A-Za-z0-9+/=\s]{100,}$/.test(x)) {
    return { image: { mimeType: "image/jpeg", data: x.replace(/\s+/g, "") }, rejected: false };
  }
  return { image: null, rejected: true };
}

function parseInput(body: unknown): ParsedInput {
  if (!body || typeof body !== "object") throw new HttpError(400, "Geçersiz istek gövdesi.");
  const b = body as Record<string, unknown>;

  const model = typeof b.model === "string" ? cleanLine(b.model, 120) : "";
  if (model.length < 2) throw new HttpError(400, "Lütfen geçerli bir cihaz modeli girin.");

  const price = typeof b.listingPrice === "number" ? b.listingPrice : Number(b.listingPrice);
  if (!Number.isFinite(price) || price < 1000 || price > 1_000_000) {
    throw new HttpError(400, "Lütfen 1.000 TL ile 1.000.000 TL arasında geçerli bir ilan fiyatı girin.");
  }

  const tags = Array.isArray(b.tags)
    ? b.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => cleanLine(t, 40))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const sellerNote = typeof b.sellerNote === "string" ? cleanBlock(b.sellerNote, 2000) : "";
  const { image, rejected } = parseImage(b.image);

  return { model, listingPrice: Math.round(price), tags, sellerNote, image, imageRejected: rejected };
}

// ---------------------------------------------------------------------------
// Cihaz Bilgisi Türetme
// ---------------------------------------------------------------------------

function deriveStorage(model: string): string {
  const m = model.match(/(\d{2,4})\s?(gb|tb)/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : "";
}

function deriveCondition(tags: string[]): Cond {
  const has = (t: string) => tags.includes(t);
  if (has("Çizikler Var")) return "fair";
  const scratched = has("Ufak Çizikler Var");
  if (!scratched && !has("Pil Değişmiş") && has("Değişensiz / Orijinal") && has("Pil %85+") && has("Face ID / True Tone Aktif")) {
    return "like_new";
  }
  return "good";
}

const COND_LABEL: Record<Cond, string> = {
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

function buildSearchPrompt(model: string, sellerNote: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const isUrl = sellerNote && (sellerNote.startsWith("http://") || sellerNote.startsWith("https://") || sellerNote.includes(".com"));
  
  if (isUrl) {
    return `Bugünün tarihi ${today}. Kullanıcının belirttiği şu ilan bağlantısını ve içeriğini Google Search ile derinlemesine incele: "${sellerNote}"
Ayrıca Türkiye'deki ikinci el pazarında "${model}" için güncel ilanları ve fiyat medyanını araştır.
Kurallar:
- İlanın detaylarını, fiyatını ve içerik bağlamını tam olarak analiz et.
- Cevabın ilk satırı tam olarak "İLANLAR:" olsun, altında ilgili ilanlar için tek satır yer alsın.
- Satır formatı: - [Kaynak] Başlık | Fiyat TL | Tarih | Bağlantı
- En fazla 15 satır döndür.`;
  }

  return `Bugünün tarihi ${today}. Türkiye'deki ikinci el pazarında şu cihaz için güncel ilanları Google Search ile ara: "${model}".
Ek Satıcı Notu/Açıklaması: "${sellerNote}"
Kurallar:
- Sadece gerçek ve güncel ilanları listele. Uydurma veri ekleme.
- Aksesuar, kılıf, yedek parça ve sıfır ürünleri ele.
- Cevabın ilk satırı tam olarak "İLANLAR:" olsun, altında her ilan için tek satır yer alsın.
- Satır formatı: - [Kaynak] Başlık | Fiyat TL | Tarih | Bağlantı (yok)
- En fazla 15 satır döndür.`;
}

function buildExtractPrompt(model: string, raw: string): string {
  return `Aşağıdaki ham metinden ve web arama sonuçlarından "${model}" için ikinci el ilanlarını ayıkla ve saf JSON dizisi olarak döndür.
Kurallar:
- Sadece geçerli ilanları al, uydurma fiyat ekleme.
- Fiyat TL cinsinden tam sayı olsun.
- "condition" yalnızca "like_new", "good", "fair" veya "poor" olabilir.
- Çıktı yalnızca saf JSON dizisi olsun: [{"title":"","price":0,"source":"","condition":"good","date":null,"url":null}]

HAM METİN:
${raw.slice(0, 12000)}`;
}

function normCondition(x: unknown): string | undefined {
  return x === "like_new" || x === "good" || x === "fair" || x === "poor" ? x : undefined;
}

function toComps(parsed: unknown): CompListing[] {
  if (!Array.isArray(parsed)) return [];
  const out: CompListing[] = [];
  for (const it of parsed) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const title = str(o.title, 160);
    const source = str(o.source, 40) || "Bilinmiyor";
    let price = typeof o.price === "number" ? o.price : Number(String(o.price ?? "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(price)) continue;
    price = Math.round(price);
    if (!title || price <= 0) continue;
    const comp: CompListing = { title, price, source, condition: normCondition(o.condition) };
    if (typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date)) comp.date = o.date;
    if (typeof o.url === "string" && /^https?:\/\//.test(o.url)) comp.url = o.url.slice(0, 300);
    out.push(comp);
    if (out.length >= 40) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Borsa ve Mühendislik Düzeyinde Rapor Sistemi
// ---------------------------------------------------------------------------

const REPORT_SYSTEM = `Sen Türkiye ikinci el cep telefonu piyasasını kusursuz bilen kıdemli bir donanım mühendisi, siber güvenlik uzmanı ve borsa analistisin.
Kurallar:
- Yalnızca Türkçe ve saf JSON döndür (markdown blokları kullanma).
- Mühendislik ve pazar likiditesi diliyle, son derece profesyonel ve teknik açıklamalar yap.
- Pil döngü ömrü, OLED piksel yıpranması, silikon performansı, link içeriği ve pazar rasyolarını detaylı açıkla.
- Verilen sayıları ve kararları ASLA değiştirme.`
;

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
  "technicalComments": "İşlemci mimarisi, batarya kimyası, ekran paneli aşınması, link içeriğindeki riskler ve onarım potansiyeli hakkında derinlemesine teknik analiz (2-3 paragraf)",
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

function toAiText(parsed: unknown, listingPrice: number, estimateMode: boolean): AiText | null {
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
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 1000 && max > min) {
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
    const input = parseInput(body);

    const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
    const searchModel = process.env.GEMINI_SEARCH_MODEL || primary;
    const ai = new GoogleGenAI({ apiKey });

    const storage = deriveStorage(input.model);
    const condition = deriveCondition(input.tags);
    const hasBox = input.tags.includes("Kutulu & Faturalı");
    const hasWarranty = input.tags.includes("Garantisi Var");

    const warnings: string[] = [];
    let usedFallback = false;
    const modelsUsed: string[] = [];

    // ---- Adım 1 & 2: Pazar Taraması ve Link Analizi (Önbellek Kontrollü) ----
    const cacheKey = `${input.model.toLowerCase().replace(/\s+/g, " ")}|${storage}`;
    let comps: CompListing[] = [];
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
        warnings.push("Canlı pazar ve link taraması sınırlı kaldı, değerleme teknik amortisman matrisiyle desteklendi.");
      }
      if (searchOk && comps.length > 0 && !hasLinkOrNote) {
        setCachedComps(cacheKey, { comps, sourceLinks, groundingCount, at: Date.now() });
      }
    }

    // ---- Adım 3: Matematiksel Değerleme ve Karar Motoru ----
    const device: DeviceInfo = { model: input.model, storage, condition, hasBox, hasWarranty };
    const valuation = valuate(device, comps);
    let confidence = valuation.confidence;

    if (valuation.marketPrice) {
      if (!storage) confidence = Math.max(30, confidence - 10);
      if (groundingCount === 0) confidence = Math.min(confidence, 45);
    }
    const judgment = judge(input.listingPrice, { ...valuation, confidence });
    if (judgment.estimated) confidence = 20;

    let decision = judgment.decision;
    const estimateMode = judgment.estimated;
    if (valuation.marketPrice && groundingCount === 0) {
      warnings.push("İlan bilgileri harici web kaynaklarıyla doğrulanamadı.");
      if (decision === "buy") decision = "negotiate";
    }
    if (estimateMode) {
      warnings.push("Yeterli ilan verisi bulunamadı; fiyatlar silikon amortisman matrisine dayanmaktadır.");
    }
    if (judgment.suspiciouslyLow) {
      warnings.push("İlan fiyatı piyasa ortalamasının çok altındadır. Dolandırıcılık veya ağır hasar riski mevcuttur.");
    }
    warnings.push(...sellerNoteWarnings(input.sellerNote));

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
      aiText = toAiText(extractJson(report.text), input.listingPrice, estimateMode);
    } catch (err) {
      console.error("[ekspertiz] rapor metin üretim hatası:", err instanceof Error ? err.message : err);
      warnings.push("Yapay zeka teknik yorumları üretilemedi, sayısal sonuçlar koddan hesaplandı.");
    }

    // ---- Çıktıları Birleştirme ve Alternatif Eşleştirme ----
    let marketPrice: PriceRange | null = valuation.marketPrice;
    let marketPriceIsEstimate = false;
    if (!marketPrice && aiText?.estimatedRange) {
      const { min, max } = aiText.estimatedRange;
      marketPrice = { min, max, median: round100((min + max) / 2), currency: "TL" };
      marketPriceIsEstimate = true;
    }

    let targetOffer = judgment.suggestedOffer;
    let walkAwayPrice = judgment.walkAwayPrice;
    if (marketPriceIsEstimate && marketPrice) {
      targetOffer = round100(Math.min(marketPrice.median * 0.96, input.listingPrice * 0.97));
      walkAwayPrice = Math.max(marketPrice.max, targetOffer);
    }

    const median = valuation.marketPrice?.median ?? null;
    const tactics: string[] = [
      `İlk teklifinizi ${fmtMoney(targetOffer)} olarak belirleyin ve ${fmtMoney(walkAwayPrice)} sınırını aşmayın.`,
    ];
    if (median) tactics.push(`Piyasa medyanı ${fmtMoney(median)} seviyesindedir. Satıcı ile görüşürken bu istatistiği referans alın.`);
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

    const betterAlternatives = valuation.basis.usedComps
      .filter((c) => c.price >= input.listingPrice * 0.9 && c.price <= input.listingPrice * 1.1)
      .sort((a, b) => a.price - b.price)
      .slice(0, 4)
      .map((c) => {
        const diff = Math.abs(c.price - input.listingPrice);
        const advantage =
          c.price < input.listingPrice
            ? `Mevcut ilandan ${fmtMoney(diff)} daha ekonomik.`
            : `Fiyat seviyesi yakın, ilan detaylarını karşılaştırın.`;
        return {
          title: c.title,
          price: c.price,
          source: c.source,
          advantage,
          searchQuery: `${c.source} ${c.title}`.slice(0, 120),
        };
      });

    const groundedNames = sourceLinks.map((l) => hostOf(l.uri) || l.title).filter(Boolean);
    const sourceKeys = new Set<string>();
    const sources: string[] = [];
    for (const name of [...valuation.basis.sources, ...groundedNames]) {
      const key = name.toLowerCase().replace(/\.(com\.tr|com|net|org)$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
      if (!key || sourceKeys.has(key)) continue;
      sourceKeys.add(key);
      sources.push(name);
      if (sources.length >= 12) break;
    }

    const report = {
      category: "Akıllı Telefon İleri Düzey Mühendislik Analizi",
      productName: input.model,
      listingPrice: input.listingPrice,
      marketPrice,
      marketPriceIsEstimate,
      verdict: judgment.verdict,
      decision,
      suspiciouslyLow: judgment.suspiciouslyLow,
      estimated: estimateMode,
      recommendation: judgment.message,
      confidence,
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
      summary: aiText?.summary || "Makro piyasa ve değerleme analizi başarıyla tamamlandı.",
      technicalComments: aiText?.technicalComments || "Cihazın donanım bileşenleri ve pazar likiditesi incelendi.",
      technicalItems: aiText?.technicalItems ?? [],
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
      betterAlternatives,
      alternatives: [] as string[],
      basis: {
        ...valuation.basis,
        sources,
        sourceLinks: sourceLinks.slice(0, 8),
        groundedSourceCount: groundingCount,
        fromCache: compsFromCache,
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