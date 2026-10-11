import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

type Body = { model?: string; price?: number; features?: string[]; note?: string; link?: string; image?: string | null };
type Level = "low" | "medium" | "high";

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ ok: false, code, error }, { status });
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
const list = (v: unknown, n: number): any[] => (Array.isArray(v) ? v.slice(0, n) : []);
const lv = (v: unknown): Level => (["low", "medium", "high"].includes(v as string) ? (v as Level) : "medium");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildPrompt(b: Body, price: number, hasImage: boolean) {
  return `Sen Türkiye ikinci el telefon piyasasını çok iyi bilen, dürüst bir ekspertiz ve satın alma danışmanısın.
Alıcıya bu ürünü EN UYGUN şekilde alması için teknik rapor, risk raporu ve karar desteği hazırla. Fiyatlar TL.

Cihaz: ${b.model}
İstenen fiyat: ${price} TL
Alıcının bildiği özellikler: ${(b.features ?? []).join(", ") || "belirtilmedi"}
Satıcı notu: ${(b.note ?? "").slice(0, 2000) || "yok"}
İlan bağlantısı (sadece referans, içeriğine erişilemedi): ${b.link || "yok"}
Görsel: ${hasImage ? "ekte. Çizik, kırık, kasa, ekran, kutu, aksesuar durumunu görselden değerlendir. Görmediğini uydurma." : "yok"}

Kurallar:
- Canlı piyasa verin yok; fiyat aralıkları tahmindir, emin değilsen null ver.
- Aralığı özelliklere ve kondisyona göre ayarla (kutulu/faturalı artı; pil değişmiş, çizik eksi).
- specs ve knownIssues sadece bildiğin, güvenilir bilgilerden oluşsun. Emin değilsen boş bırak, uydurma.
- risks, scamSignals, checklist ve questions bu ilana özel olsun. Satıcı notunda şüpheli ifade (acil satış, kapora, kargo, IMEI vermeme gibi) varsa scamSignals'a yaz.
- checklist 6-8 adım: Türkiye'ye uygun, uygulanabilir (IMEI kaydı sorgusu, iCloud/Find My veya Google hesap kilidi, pil sağlığı, ekran, kamera, hoparlör/mikrofon, tamir izi, fatura/garanti gibi), her adımda "nasıl kontrol edilir" yaz.
- buyScore: 0-100, satın almaya ne kadar uygun olduğu (fiyat, kondisyon, risk birlikte).

SADECE şu JSON'u döndür:
{"productName":string,"marketMin":number|null,"marketMax":number|null,"fairPrice":number|null,"offerPrice":number|null,"walkAwayPrice":number|null,"confidence":number,"buyScore":number,
"summary":string,"condition":string|null,
"specs":[{"label":string,"value":string}] (en çok 8),
"knownIssues":[{"title":string,"level":"low"|"medium"|"high","detail":string}] (en çok 4),
"risks":[{"category":"Fiyat"|"Kondisyon"|"Belge"|"Satıcı"|"Teknik","level":"low"|"medium"|"high","text":string}] (en çok 6),
"scamSignals":[string] (en çok 4),
"checklist":[{"step":string,"how":string}],
"alternatives":[{"name":string,"approxPrice":number|null,"why":string}] (en çok 3),
"questions":[string] (en çok 5),
"negotiation":string (açılış teklifi ve kısa pazarlık konuşması)}`;
}

const RETRYABLE = [404, 429, 500, 502, 503, 504];

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return fail(500, "NO_KEY", "GEMINI_API_KEY bulunamadı. .env.local dosyasını kontrol edip dev sunucusunu yeniden başlatın.");

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return fail(400, "BAD_JSON", "İstek okunamadı.");
  }
  const model = (b.model ?? "").trim().slice(0, 120);
  const price = Number(b.price);
  if (!model || !Number.isFinite(price) || price <= 0) return fail(400, "BAD_INPUT", "Cihaz modeli ve geçerli bir fiyat gerekli.");
  b.model = model;

  const parts: unknown[] = [];
  let hasImage = false;
  if (b.image && b.image.startsWith("data:image/")) {
    const comma = b.image.indexOf(",");
    const mime = b.image.slice(5, b.image.indexOf(";"));
    if (comma > 0) {
      parts.push({ inlineData: { mimeType: mime, data: b.image.slice(comma + 1) } });
      hasImage = true;
    }
  }
  parts.unshift({ text: buildPrompt(b, price, hasImage) });

  const payload = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
  });
  const plan = [
    { model: MODEL, ms: 30000 },
    { model: MODEL, ms: 25000 },
    { model: FALLBACK, ms: 25000 },
  ];

  let res: Response | null = null;
  let lastStatus = 0;
  let timedOut = false;
  let skip = "";
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    if (step.model === skip) continue;
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${step.model}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: AbortSignal.timeout(step.ms) }
      );
      if (r.ok) {
        res = r;
        if (i > 0) console.warn("[ekspertiz] yanıt şu modelden alındı:", step.model);
        break;
      }
      lastStatus = r.status;
      timedOut = false;
      console.error(`[ekspertiz] ${step.model} ${r.status} (deneme ${i + 1}/${plan.length})`, (await r.text()).slice(0, 400));
      if (r.status === 429) skip = step.model;
      else if (!RETRYABLE.includes(r.status)) break;
    } catch (e) {
      timedOut = true;
      lastStatus = 0;
      console.error(`[ekspertiz] ${step.model} zaman aşımı/ağ hatası (deneme ${i + 1}/${plan.length})`, e);
    }
    if (i < plan.length - 1) await sleep(1000);
  }

  if (!res) {
    if (timedOut || lastStatus === 504) return fail(504, "UPSTREAM_TIMEOUT", "Gemini zamanında yanıt vermedi. Birkaç saniye sonra tekrar deneyin.");
    const msg =
      lastStatus === 503 ? "Gemini şu an yoğun (503). Birkaç saniye sonra tekrar deneyin."
      : lastStatus === 429 ? "Gemini kota sınırı doldu (429). Bir süre bekleyin ya da .env.local içinde GEMINI_MODEL değerini başka bir modele çevirin."
      : lastStatus === 401 || lastStatus === 403 ? "API anahtarı yetkisiz veya geçersiz."
      : lastStatus === 400 || lastStatus === 404 ? `Model adı (${MODEL}) veya istek geçersiz olabilir. .env.local içindeki GEMINI_MODEL değerini kontrol edin.`
      : `Gemini hata verdi (${lastStatus}).`;
    return fail(502, "UPSTREAM_" + lastStatus, msg);
  }

  let raw: any;
  try {
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    raw = JSON.parse(text.replace(/^```json|```$/gim, "").trim());
  } catch (e) {
    console.error("[ekspertiz] JSON ayrıştırma", e);
    return fail(502, "BAD_MODEL_OUTPUT", "Yapay zeka yanıtı okunamadı. Tekrar deneyin.");
  }

  const marketMin = num(raw.marketMin);
  const marketMax = num(raw.marketMax);
  let verdict: "great_deal" | "fair" | "expensive" | "unknown" = "unknown";
  if (marketMin && marketMax) verdict = price <= marketMin ? "great_deal" : price <= marketMax * 1.05 ? "fair" : "expensive";

  const risks = list(raw.risks, 6).map((x) => ({ category: str(x?.category, 30) || "Genel", level: lv(x?.level), text: str(x?.text) }));
  const buyScore = Math.max(0, Math.min(100, Math.round(Number(raw.buyScore) || 0)));
  const highRisks = risks.filter((x) => x.level === "high").length;
  let decision: "buy" | "negotiate" | "avoid" = buyScore >= 75 && highRisks === 0 ? "buy" : buyScore >= 50 ? "negotiate" : "avoid";
  if (verdict === "expensive" && decision === "buy") decision = "negotiate";

  const result = {
    productName: str(raw.productName, 120) || model,
    verdict,
    decision,
    buyScore,
    marketMin,
    marketMax,
    fairPrice: num(raw.fairPrice),
    offerPrice: num(raw.offerPrice),
    walkAwayPrice: num(raw.walkAwayPrice),
    confidence: Math.max(0, Math.min(100, Math.round(Number(raw.confidence) || 0))),
    summary: str(raw.summary, 900),
    condition: raw.condition ? str(raw.condition, 500) : null,
    specs: list(raw.specs, 8).map((x) => ({ label: str(x?.label, 40), value: str(x?.value, 80) })),
    knownIssues: list(raw.knownIssues, 4).map((x) => ({ title: str(x?.title, 80), level: lv(x?.level), detail: str(x?.detail) })),
    risks,
    scamSignals: list(raw.scamSignals, 4).map((x) => str(x)),
    checklist: list(raw.checklist, 8).map((x) => ({ step: str(x?.step, 120), how: str(x?.how) })),
    alternatives: list(raw.alternatives, 3).map((x) => ({ name: str(x?.name, 80), approxPrice: num(x?.approxPrice), why: str(x?.why) })),
    questions: list(raw.questions, 5).map((x) => str(x)),
    negotiation: str(raw.negotiation, 900),
  };

  return NextResponse.json({ ok: true, result });
}