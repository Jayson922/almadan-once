// src/lib/riskEngine.ts
// ALMADAN ÖNCE — Risk Motoru (4. motor)
// Bağımlılık yok (yalnızca marketEngine.norm). Saf, deterministik TypeScript; yapay zekaya ihtiyaç duymaz.
//
// Altı kategori: IMEI ve kilit, ekran, pil, parça geçmişi, garanti/fatura, dolandırıcılık.
// Her sinyalin kaynağı ayrı yazılır: ilan metni beyanı, kullanıcı beyanı, hesaplama, elde doğrulama, eksik bilgi.
// Satıcı beyanı hiçbir zaman "doğrulanmış" sayılmaz. Bilgi eksikse bu "güvenli" demek değildir,
// raporda tamlık oranı (dataCompleteness) ile açıkça gösterilir.
//
// R1: Olumsuzlama ("çalıntı değildir", "kapora istemiyorum", "ekranı değişmedi" gibi) artık kapsamlı ve
//     kapsam sınırlı bir mekanizmayla ele alınır (stripNegations). Tek tek yazılmış kusur listesi kaldırıldı.
// R2: Kural düzeltmeleri (kilidi, ekranda, ithalatçı, kapora, pil servis, değişmedi, arka cam, kamera camı).

import { norm } from "./marketEngine";

// ───────────────────────── Tipler ─────────────────────────

export type Severity = "ok" | "unknown" | "low" | "medium" | "high" | "critical";
export type RiskCategoryId = "imei" | "screen" | "battery" | "parts" | "warranty" | "fraud";
export type RiskLevel = "dusuk" | "orta" | "yuksek" | "kritik";
export type SignalBasis = "ilan metni" | "kullanıcı beyanı" | "hesaplandı" | "elde doğrulandı" | "eksik bilgi";
export type Advice = "kacin" | "elden_dogrula" | "dikkatli_al" | "makul";

export interface RiskSignal {
  id: string;
  category: RiskCategoryId;
  severity: Severity;
  message: string;
  basis: SignalBasis;
  action?: string; // elden yapılacak kontrol
  negotiation?: string; // pazarlıkta kullanılabilecek gerekçe
}

export interface CategoryRisk {
  id: RiskCategoryId;
  label: string;
  score: number; // 0-100
  level: RiskLevel;
  signals: RiskSignal[];
  hasEvidence: boolean; // beyan veya doğrulama var mı (yalnızca "eksik bilgi" değil)
}

export interface ChecklistItem {
  id: string;
  category: RiskCategoryId;
  text: string;
  priority: 1 | 2 | 3; // 1 = ilk yapılacak
}

export interface RiskReport {
  overall: { score: number; level: RiskLevel; label: string };
  advice: Advice;
  adviceText: string;
  summary: string;
  categories: Record<RiskCategoryId, CategoryRisk>;
  criticalFlags: RiskSignal[];
  topRisks: RiskSignal[];
  positives: RiskSignal[];
  unknowns: RiskSignal[];
  handoverChecklist: ChecklistItem[];
  negotiationPoints: string[];
  dataCompleteness: number; // 0-1: kaç kategoride gerçek bilgi var
  imei: ImeiCheck | null;
  disclaimers: string[];
}

/** Elden teslimde kullanıcının işaretlediği sonuçlar. true = sorun yok, false = sorun var, null/undefined = bakılmadı. */
export interface HandoverChecks {
  imeiMatchesBox?: boolean | null;
  imeiRegistered?: boolean | null; // e-Devlet sorgusu sonucu
  accountsRemoved?: boolean | null; // iCloud / Google çıkışı, Bul kapalı
  screenTestPassed?: boolean | null;
  partsHistoryClean?: boolean | null;
  warrantyVerified?: boolean | null;
}

export interface RiskInput {
  model?: string;
  title?: string;
  sellerNote?: string;
  description?: string;
  tags?: string[];
  listingPrice?: number | null;
  marketMedian?: number | null;
  batteryHealthPct?: number | null;
  usageMonths?: number | null;
  imei?: string | null;
  deliveryType?: "kargo" | "elden" | "ikisi" | null;
  checks?: HandoverChecks;
}

export interface ImeiCheck {
  valid: boolean;
  digits: string;
  reason: string;
}

// ───────────────────────── Sabitler ─────────────────────────

const SEV_P: Record<Severity, number> = { ok: 0, unknown: 0.05, low: 0.08, medium: 0.25, high: 0.5, critical: 0.85 };
const SEV_RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, unknown: 1, ok: 0 };
const CAT_WEIGHT: Record<RiskCategoryId, number> = { imei: 1, fraud: 1, parts: 0.8, screen: 0.7, battery: 0.6, warranty: 0.4 };
const CAT_LABEL: Record<RiskCategoryId, string> = {
  imei: "IMEI ve kilit",
  screen: "Ekran",
  battery: "Pil",
  parts: "Parça geçmişi",
  warranty: "Garanti ve fatura",
  fraud: "Dolandırıcılık işaretleri",
};
const CAT_ORDER: RiskCategoryId[] = ["imei", "fraud", "parts", "screen", "battery", "warranty"];

/** Aşırı uzun metinlerde regex maliyetini sınırlamak için analiz edilen en fazla karakter. */
const MAX_TEXT = 12000;

const levelOf = (score: number): RiskLevel => (score < 15 ? "dusuk" : score < 35 ? "orta" : score < 60 ? "yuksek" : "kritik");
const overallLevelOf = (score: number): RiskLevel => (score < 20 ? "dusuk" : score < 40 ? "orta" : score < 65 ? "yuksek" : "kritik");
const LEVEL_LABEL: Record<RiskLevel, string> = { dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek", kritik: "Kritik" };

// ───────────────────────── IMEI ─────────────────────────

export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Biçim ve kontrol hanesi doğrulaması. Kayıt/kara liste durumunu SÖYLEMEZ, o yalnızca e-Devlet sorgusuyla öğrenilir. */
export function validateImei(raw?: string | null): ImeiCheck | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 16) {
    return { valid: false, digits, reason: "16 hane girildi. IMEI 15 hanelidir; *#06# ile tekrar okuyun." };
  }
  if (digits.length !== 15) {
    return { valid: false, digits, reason: `IMEI 15 haneli olmalı, ${digits.length} hane girildi.` };
  }
  if (/^(\d)\1+$/.test(digits) || digits.startsWith("000000")) {
    return { valid: false, digits, reason: "IMEI geçersiz (sıfır veya tekrarlayan rakamlar)." };
  }
  if (!luhnValid(digits)) {
    return { valid: false, digits, reason: "Kontrol hanesi tutmuyor: yazım hatası ya da sahte/değiştirilmiş IMEI olabilir." };
  }
  return { valid: true, digits, reason: "Biçim ve kontrol hanesi geçerli. Bu, cihazın kayıtlı/engelsiz olduğu anlamına gelmez." };
}

// ───────────────────────── Metin hazırlama ─────────────────────────

/**
 * Türkçe harfleri ASCII'ye indirger ve küçültür. Noktalama (. , ; ! ?) bilerek korunur:
 * olumsuzlama kapsamı cümle ve virgül sınırlarına bakar. Kesme işaretleri silinir ("ekran'da" -> "ekranda").
 */
function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´‘]/g, "")
    .replace(/\//g, " ve ")
    .replace(/[&+]/g, " ve ")
    .replace(/[^a-z0-9\s%*#.,;:!?=-]/g, " ")
    .replace(/,(?=\S)/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Olumsuzlamaları tek kelimeye (ya da olumlu işarete) çevirir. Bunlar olumsuzlama kapsamından ÖNCE çalışır.
 * Kalıpların sonundaki \w* ekleri ("değildir", "yoktur") tüketir; böylece \b sınırları bozulmaz.
 */
const FLIPS: [RegExp, string][] = [
  // "çalıntı değil", "karalistede değil", "bloke yok" -> cihaz temiz beyanı
  [/\b(?:calinti|kara ?list\w*|bloke\w*|kayip(?: cihaz)?) (?:degil\w*|olmayan|yok\w*)/g, " imei temiz "],
  [/\bkayitli degil\w*/g, " kayitsiz "],
  [/\bkilitli degil\w*|\bkilidi yok\w*|\bkilit yok\w*/g, " kilitsiz "],
  [/\bgaranti(?:si)? yok\w*/g, " garantisiz "],
  [/\bfatura(?:si)? yok\w*|\bfatura bulunmuyor/g, " faturasiz "],
  [/\bkutu(?:su)? yok\w*/g, " kutusuz "],
  [/\bariza(?:si)? yok\w*/g, " arizasiz "],
  [/\bicloud yok\w*|\bicloud kapali|\bicloud temiz|\bhesap(?:i)? kapali/g, " hesapsiz "],
  // "pili yenilenmiş" parça değişimidir; "yenilenmiş cihaz" kuralıyla karışmasın
  [/\b(?:pil|batarya)\w* yenilen(?:mis|di)\b/g, " pil degismis "],
  [/\bekran\w* yenilen(?:mis|di)\b/g, " ekran degismis "],
];

// Olumsuzlama kapsamı: yalnızca "kusur sözlüğü" kelimeleri silinir. Böylece "pazarlık yok", "elden yok",
// "iade yok", "ekran orijinal değil", "face id yok" gibi kendi başına risk taşıyan ifadeler korunur.
const CORE_WORDS = [
  "kirik\\w*", "catlak\\w*", "patlak\\w*", "cizik\\w*", "cizgi\\w*", "leke\\w*", "yanik\\w*", "yanig\\w*",
  "piksel\\w*", "olu", "titre\\w*", "degisen\\w*", "degisim\\w*", "boya\\w*", "hasar\\w*", "tamir\\w*",
  "onarim\\w*", "ariza\\w*", "su", "oksit\\w*", "korozyon", "sizinti\\w*", "sivi", "islan\\w*", "anakart\\w*",
  "lehim\\w*", "reball\\w*", "servis\\w*", "uyari\\w*", "mesaj\\w*", "oneri\\w*", "sorun\\w*", "problem\\w*",
  "hata\\w*", "kusur\\w*", "calinti\\w*", "kara", "liste\\w*", "karalist\\w*", "bloke\\w*", "kapora\\w*",
  "odeme\\w*", "iban", "havale", "eft", "yurt", "disi", "yurtdisi\\w*", "ithal", "kibris", "kktc", "dubai",
  "kilit\\w*", "kilid\\w*", "icloud\\w*", "mdm", "frp", "kurumsal", "hesap\\w*", "aktivasyon", "activation", "lock",
];
const CORE_RE = new RegExp(`^(?:${CORE_WORDS.join("|")})$`);
const FILLER_RE =
  /^(?:ekran\w*|kasa\w*|govde\w*|cihaz\w*|telefon\w*|pil|pili|pilde|batarya\w*|kamera\w*|cam\w*|arka\w*|on|yan|kenar\w*|kose\w*|uzerinde|icinde|belirgin|gorunur|ciddi|buyuk|ufak|kucuk|hafif|kozmetik|fiziksel|donanimsal|ic|dis)$/;
const CONNECT = new Set(["ve", "veya", "ya", "da", "de", "hic", "hicbir", "herhangi", "bir", "asla", "kesinlikle"]);

// "yok", "değil", "istemiyorum" gibi olumsuzlayıcılar: kapsamda en az bir kusur kelimesi olmalı.
const GENERIC_NEG = new Set([
  "yok", "yoktur", "yoktu", "bulunmuyor", "bulunmamaktadir", "bulunmamakta", "bulunmaz", "degil", "degildir",
  "olmayan", "olmaz", "olmuyor", "gozukmuyor", "gorunmuyor", "cikmiyor", "vermiyor", "istemiyorum", "istemem",
  "istemiyoruz", "almam", "almiyorum", "almiyoruz", "alinmaz", "alinmamaktadir", "alinmiyor", "verilmez",
  "istenmez", "istenmiyor", "istenmemektedir",
]);
// Fiilin kendisi olumsuz ("değişmedi", "açılmadı"): önündeki isim öbeğini silmek için kusur kelimesi gerekmez.
const VERB_NEG = new Set([
  "degismedi", "degismemis", "degismemistir", "degistirilmedi", "degistirilmemis", "yapilmadi", "yapilmamis",
  "acilmadi", "acilmamis", "gormedi", "gormemis", "gormemistir", "yenilenmedi", "edilmedi", "edilmemis",
  "gitmedi", "girmedi", "olmadi", "olmamis", "olmamistir",
]);

const MAX_SCOPE = 10;

const isVocab = (w: string): boolean => CORE_RE.test(w) || FILLER_RE.test(w) || CONNECT.has(w);

interface Tok {
  w: string;
  comma: boolean;
}

/** Tek bir cümleciğin olumsuzlanan kusur ifadelerini siler (yerlerine ";" bırakır). */
function stripClause(clause: string): string {
  const raw = clause.split(/\s+/).filter(Boolean);
  const n = raw.length;
  if (n === 0) return "";
  const toks: Tok[] = raw.map((r) => ({ w: r.replace(/^[,:()=*#-]+|[,:()=*#-]+$/g, ""), comma: r.endsWith(",") }));
  const removed: boolean[] = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    const cur = toks[i];
    if (!cur || removed[i]) continue;
    const verb = VERB_NEG.has(cur.w);
    if (!verb && !GENERIC_NEG.has(cur.w)) continue;

    let start = i;
    let core = false;
    let includedPure = true;
    let firstItem = true;
    let idx = i - 1;
    let budget = MAX_SCOPE;

    while (idx >= 0 && budget > 0) {
      // Bir "öğe": virgüllerle ayrılmış, yalnızca sözlük kelimelerinden oluşan parça.
      let itemStart = idx + 1;
      let itemCore = false;
      let pure = true;
      let k = idx;
      while (k >= 0 && budget > 0) {
        const tk = toks[k];
        if (!tk || removed[k]) break;
        if (k !== idx && tk.comma) break; // virgül öğeyi böler
        if (!isVocab(tk.w)) break;
        const isCore = CORE_RE.test(tk.w);
        if (isCore) itemCore = true;
        if (!isCore && !CONNECT.has(tk.w)) pure = false;
        itemStart = k;
        k--;
        budget--;
      }
      if (itemStart > idx) break; // hiç kelime alınmadı
      // Virgülün ötesine yalnızca saf kusur listelerinde geçilir: "kırık, çatlak, çizik yok".
      // "ekran kırık, boya yok" gibi durumlarda "ekran kırık" korunur (gerçek risk).
      if (!firstItem && !(includedPure && pure && itemCore)) break;
      start = itemStart;
      core = core || itemCore;
      includedPure = includedPure && pure;
      const prev = itemStart - 1;
      const pt = toks[prev];
      if (!pt || !pt.comma) break;
      idx = prev;
      firstItem = false;
    }

    if (!verb && !core) continue;
    for (let k = start; k <= i; k++) removed[k] = true;
  }

  const out: string[] = [];
  let inRemoved = false;
  for (let k = 0; k < n; k++) {
    if (removed[k]) {
      if (!inRemoved) {
        out.push(";");
        inRemoved = true;
      }
    } else {
      inRemoved = false;
      out.push(raw[k] ?? "");
    }
  }
  return out.join(" ");
}

function stripNegations(text: string): string {
  return text
    .split(/[.!?;\n]+|\s(?:ama|fakat|ancak|lakin)\s/)
    .map(stripClause)
    .join(" . ");
}

/** flipped: olumsuzlamalar tek kelimeye çevrilmiş metin (olumlu beyanlar için). stripped: olumsuzlanan kusurlar silinmiş metin (risk kuralları için). */
function prepare(text: string): { flipped: string; stripped: string } {
  let t = fold(text)
    .replace(/\barka cam\w*/g, "arkacam")
    .replace(/\bkamera (?:cam|lens)\w*/g, "kameracam");
  for (const [re, to] of FLIPS) t = t.replace(re, to);
  t = t.replace(/\s+/g, " ").trim();
  return { flipped: t, stripped: stripNegations(t) };
}

// ───────────────────────── Kural tablosu ─────────────────────────

interface Rule {
  id: string;
  cat: RiskCategoryId;
  re: RegExp;
  sev: Severity;
  msg: string;
  action?: string;
  neg?: string;
  on?: "flipped"; // olumlu beyan kuralları flipped metinde aranır
}

const RULES: Rule[] = [
  // ── IMEI ve kilit ──
  { id: "imei-engelli", cat: "imei", sev: "critical", re: /karaliste|kara liste|blokeli|\bbloke\b|imei (kayitsiz|kapali|iptal|engelli)|\bkayitsiz\b|\bcalinti|kayip cihaz|cihaz (kayip|calindi)/,
    msg: "İlanda cihazın kayıtsız, engelli ya da çalıntı olabileceğine dair ifade var.", action: "e-Devlet IMEI sorgusunda cihazın kayıtlı ve engelsiz olduğunu doğrulamadan satın almayın." },
  { id: "imei-klon", cat: "imei", sev: "critical", re: /imei (degis|klon|ayni|yazilim|onarim)|ikinci imei|klon imei|imei repair/,
    msg: "İlanda IMEI değiştirme/klon ifadesi var.", action: "Cihazı almayın." },
  { id: "kilit-hesap", cat: "imei", sev: "critical",
    re: /icloud\w* (?:hesab\w* )?(?:acik|kapatilmadi|silinmedi|kalmis|bagli|duruyor)|icloud\w* (?:kilitli\b|kilid\w*(?! (?:temiz|kapali|sorunsuz|yok)))|activation lock|aktivasyon kilid\w*|\bmdm\b|kurumsal (?:hesap|kilit)\w*|find my (?:acik|aktif)|\bbul (?:ozelligi |servisi )?(?:acik|aktif)\b|google hesab\w* (?:acik|silinmedi|kapatilmadi|bagli)|\bfrp\b|hesap silinmedi|(?:icloud|apple|google|hesap)\w* (?:sifre\w*|parola\w*) (?:bilmiyorum|bilinmiyor|unutul\w*|unuttum|hatirlam\w*)|sifre(?:si)? (?:unutul\w*|bilinmiyor)/,
    msg: "İlanda hesap/aktivasyon kilidi ya da kurumsal kilit ifadesi var.", action: "Satıcı önünüzde hesaptan çıkış yapıp cihazı sıfırlamadan ödeme yapmayın." },
  { id: "operator-kilit", cat: "imei", sev: "high",
    re: /(?:operator\w*|\bsim\b|\bhat\b|turkcell|vodafone|turk telekom|network) (?:kilitli\b|kilid\w*(?! (?:yok|temiz)))|carrier lock|simlock|operatore (?:bagli|kilitli)/,
    msg: "Operatör/SIM kilidi ifadesi var.", action: "Kendi SIM kartınızla şebeke testi yapın.", neg: "Operatör kilidi cihazın değerini düşürür." },
  { id: "yurtdisi", cat: "imei", sev: "medium",
    re: /\byurt ?disi\b|\byurt ?disindan|kibris|kktc|dubai|\babd (versiyon|model|cihaz|garantili|menseli)|\babdden\b|japonya|\bithal\b|\bithal (cihaz|urun|telefon|edil\w*)|\busa\b/,
    msg: "Cihaz yurt dışı kaynaklı olabilir; kayıt ve garanti durumu farklı olabilir.", action: "IMEI'nin Türkiye'de kayıtlı olduğunu e-Devlet'ten doğrulayın.", neg: "Yurt dışı cihazda TR garantisi yoktur, pazarlıkta düşün." },
  { id: "imei-pozitif", cat: "imei", sev: "ok", on: "flipped", re: /imei (kayitli|temiz|sorunsuz)|kayitli (cihaz|telefon)|turkiye (cihazi|garantili|versiyon)|\btr (cihaz|garantili|versiyon)|turk cihazi/,
    msg: "Satıcı cihazın TR/IMEI kayıtlı olduğunu beyan ediyor (doğrulanmadı)." },
  { id: "kilitsiz-pozitif", cat: "imei", sev: "ok", on: "flipped", re: /kilitsiz|hesapsiz|hesaplar? (silindi|cikis yapildi|kapatildi|temizlendi)|icloud (cikis|silindi|kapatildi)|sifirlanmis|fabrika ayar/,
    msg: "Satıcı hesap/kilit olmadığını ya da cihazın sıfırlandığını beyan ediyor (doğrulanmadı)." },

  // ── Ekran ──
  { id: "ekran-kirik", cat: "screen", sev: "high",
    re: /\bekran\w* (?:\w+ )?(?:kirik|catlak|patlak)|\bekran\w* (?:\w+ ){0,3}(?:kirik|catlak|patlak) var|\bon cam\w* (?:kirik|catlak)|\bcam\w* (?:kirik|catlak)|\bkirik ekran|\bcatlak ekran/,
    msg: "Ekran/cam kırık ya da çatlak.", action: "Ekranın tamamını ve kenarları inceleyin, dokunmatik testini yapın.", neg: "Kırık/çatlak ekranın değişim maliyetini pazarlıkta düşün." },
  { id: "ekran-cizgi", cat: "screen", sev: "high", re: /yesil (cizgi|hat|ekran)|pembe cizgi|mor cizgi|dikey cizgi|yatay cizgi|ekran (titr|flicker|kayma)|titriyor/,
    msg: "Ekranda renkli çizgi/titreme belirtisi var (panel ya da bağlantı arızası göstergesi).", action: "Tam ekran renk testiyle kontrol edin.", neg: "Panel arızası ekran değişimi demektir, fiyattan düşün." },
  { id: "ekran-dokunmatik", cat: "screen", sev: "high", re: /dokunmatik (sorun|calismiyor|gecikme|kasma|kendi kendine)|ghost touch|hayalet dokunma/,
    msg: "Dokunmatik sorunu belirtilmiş.", action: "Ekranın her köşesinde sürükleme ve çoklu dokunma testi yapın." },
  { id: "ekran-sensor", cat: "screen", sev: "high", re: /true tone (calismiyor|yok|kayip)|face id (calismiyor|bozuk|yok)|parmak izi (calismiyor|bozuk)|otomatik parlaklik (calismiyor|bozuk)/,
    msg: "Biyometrik/ekran sensörlerinden biri çalışmıyor olarak belirtilmiş.", action: "Face ID/parmak izi ve parlaklık sensörünü test edin.", neg: "Face ID/sensör arızası onarımı pahalıdır, pazarlıkta düşün." },
  { id: "ekran-muadil", cat: "screen", sev: "high", re: /muadil ekran|yan sanayi ekran|ekran orijinal degil|aftermarket ekran|orijinal olmayan ekran/,
    msg: "Ekran orijinal değil (muadil/yan sanayi).", action: "Renk, parlaklık ve True Tone farkına bakın.", neg: "Orijinal olmayan ekran değer kaybıdır." },
  { id: "ekran-degismis", cat: "screen", sev: "medium", re: /\bekran\w* (?:degis\w*|degistir\w*|yenilen\w*)/,
    msg: "Ekran değiştirilmiş; parçanın orijinal olup olmadığı belirsiz.", action: "Parça orijinalliğini ve True Tone durumunu kontrol edin." },
  { id: "ekran-yanik", cat: "screen", sev: "medium", re: /olu piksel|piksel (yanigi|bozuk)|burn ?in|ekran yanigi|hayalet (goruntu|ekran)|\bleke\b|beyaz leke|sizinti|sari(?:lik| ton)/,
    msg: "Ekranda ölü piksel, yanık, leke veya renk sapması belirtisi var.", action: "Beyaz, siyah, kırmızı ve yeşil tam ekran testleriyle bakın.", neg: "Ekran kusuru pazarlık gerekçesidir." },
  { id: "ekran-cizik", cat: "screen", sev: "low", re: /\bcizik/,
    msg: "Kozmetik çizik beyan edilmiş.", neg: "Belirgin çizik pazarlıkta düşülebilir." },
  { id: "ekran-pozitif", cat: "screen", sev: "ok", on: "flipped", re: /(kirik|catlak|cizik|leke|yanik|yanigi|olu piksel|cizgi|titreme) (yok|yoktur|degil\w*)|ekran (sorunsuz|temiz|kusursuz|hatasiz|orijinal)/,
    msg: "Satıcı ekranda kusur olmadığını beyan ediyor (doğrulanmadı)." },

  // ── Pil (metin) ──
  { id: "pil-sismis", cat: "battery", sev: "critical", re: /pil(?:i)? (sisti|sismis|siskin|sisme)|sisen pil|batarya sis|sismis batarya/,
    msg: "Pilde şişme belirtisi var (güvenlik riski).", action: "Şişmiş pilli cihazı almayın; kasa/ekran aralığını kontrol edin." },
  { id: "pil-servis", cat: "battery", sev: "high", re: /pil (servis|degisim) (onerisi|oneriliyor|uyarisi)|onemli pil mesaji|pil servis/,
    msg: "Cihaz pil servis/değişim uyarısı veriyor.", neg: "Pil değişim maliyetini pazarlıkta düş." },
  { id: "pil-sorun", cat: "battery", sev: "medium", re: /(sarj|pil) (cabuk|hizli) (bitiyor|biter|azaliyor)|pil (yetmiyor|cabuk bitiyor)|pil omru (kotu|az)|batarya (zayif|kotu)/,
    msg: "Pilin çabuk bittiği belirtilmiş.", neg: "Pil zayıflığı pazarlık gerekçesidir." },
  { id: "pil-kapanma", cat: "battery", sev: "medium", re: /asiri isi|isinma sorunu|kendiliginden kapan|aniden kapan|yuzde \d+ ?(de|da)? kapan/,
    msg: "Isınma ya da ani kapanma belirtilmiş (pil veya ana kart kaynaklı olabilir).", action: "Şarjda ve kullanımda ısınmayı gözlemleyin." },
  { id: "pil-degismis", cat: "battery", sev: "low", re: /pil(?:i)? (degismis|yenilenmis|degisti|degisimi yapildi)|yeni pil|batarya degis/,
    msg: "Pil değiştirilmiş (beyan). Parçanın orijinal ve servis kaydının olup olmadığı belirsiz.", action: "Ayarlarda 'bilinmeyen parça' ya da pil uyarısı var mı bakın." },

  // ── Parça geçmişi ──
  { id: "parca-anakart", cat: "parts", sev: "high", re: /anakart (onarim|tamir|degis|lehim|reball)|\breball|lehim|emmc|ic degis|chip degis/,
    msg: "Ana kart onarımı/lehim müdahalesi ifadesi var.", action: "Cihazı uzun süre test edin; ısınma, ağ ve kamera kontrolünü atlamayın.", neg: "Ana kart müdahalesi ciddi bir değer kaybıdır." },
  { id: "parca-su", cat: "parts", sev: "high", re: /su (gordu|hasari|girdi|aldi)|islandi|sivi (temasi|hasari)|oksit|korozyon/,
    msg: "Su/sıvı teması ifadesi var; uzun vadeli arıza riski yüksek.", action: "Şarj portu ve SIM tepsisi içinde oksit/renk değişimi arayın.", neg: "Su görmüş cihaz ciddi indirimle alınır." },
  { id: "parca-muadil", cat: "parts", sev: "high", re: /yan sanayi|muadil|orijinal olmayan|aftermarket|kopya parca|cin(?:i)? parca/,
    msg: "Orijinal olmayan parça kullanımı ifadesi var.", neg: "Orijinal olmayan parça değer kaybıdır." },
  { id: "parca-kasa-kamera", cat: "parts", sev: "medium", re: /\b(?:kasa|kamera|hoparlor|face id modul)\w* (?:degis\w*|degistir\w*)/,
    msg: "Kasa/kamera/hoparlör gibi bir parça değiştirilmiş.", action: "Kamera netliği, odak ve hoparlör sesini test edin." },
  { id: "parca-kamera-cam", cat: "parts", sev: "medium", re: /\bkameracam\w* (?:kirik|catlak)/,
    msg: "Kamera camı/lensi kırık ya da çatlak.", action: "Kamerayı açıp fotoğraf çekin; netlik, odak ve leke kontrolü yapın.", neg: "Kamera cam değişimi maliyetlidir, pazarlıkta düş." },
  { id: "parca-servis", cat: "parts", sev: "medium", re: /degisen (var|mevcut)|parca degisti|tamir gordu|servis gordu|acilip kapandi|onarim gordu|bakim gordu|tamir edil\w*|onarildi|tamiri yapil\w*|\btamirli\b|servise (?:gitti|verildi|gonderildi|gonderilmis)/,
    msg: "Tamir/servis görmüş ya da parça değişmiş olabilir.", action: "Parça ve Servis Geçmişi ekranına (desteklenen iPhone modellerinde) bakın." },
  { id: "parca-hafif", cat: "parts", sev: "low", re: /arkacam\w* (?:degis\w*|catlak|kirik)|sarj (soketi|portu) degis|boyali|boya var|lokal boya/,
    msg: "Küçük parça değişimi ya da boya ifadesi var." },
  { id: "parca-pozitif", cat: "parts", sev: "ok", on: "flipped", re: /(degisen|tamir|servis|boya|ariza|anakart|su hasari|hasar|acilmis) (yok|yoktur|gormedi|gormemis|yapilmadi|degil\w*)|degisensiz|tamirsiz|boyasiz|arizasiz|orijinal parca|hic acilmadi|\bacilmadi|su gormedi|\bdegismedi|\bdegismemis/,
    msg: "Satıcı parça değişimi/tamir olmadığını beyan ediyor (doğrulanmadı)." },

  // ── Garanti ve fatura ──
  { id: "garanti-yok", cat: "warranty", sev: "low", re: /garantisiz|garanti (bitti|bitmis|disi)|garantisi bitmis/,
    msg: "Garanti yok ya da bitmiş.", neg: "Garantisiz cihazda arıza riski alıcıdadır, pazarlıkta düş." },
  { id: "fatura-yok", cat: "warranty", sev: "medium", re: /faturasiz/,
    msg: "Fatura yok; cihazın menşei ve garanti hakkı belgelenemez.", action: "Satıcının kimliğini ve cihazın nereden alındığını sorun.", neg: "Faturasız cihazda risk alıcıdadır." },
  { id: "kutu-yok", cat: "warranty", sev: "low", re: /kutusuz/,
    msg: "Kutu yok; kutu etiketinden IMEI doğrulaması yapılamaz." },
  { id: "yenilenmis", cat: "warranty", sev: "medium", re: /yenilenmis|refurbished|\brefurb|teshir|demo cihaz|\boutlet\b/,
    msg: "Yenilenmiş/teşhir cihaz; parça geçmişi belirsiz olabilir.", neg: "Yenilenmiş cihaz sıfıra yakın fiyatla alınmamalı." },
  { id: "garanti-pozitif", cat: "warranty", sev: "ok", on: "flipped", re: /garantisi devam|garanti(?:si)? (var|devam)|\d+ ay garanti|apple turkiye garanti|distributor garantili|ithalatci garantili|resmi garanti|turkiye garantili/,
    msg: "Satıcı garanti beyan ediyor (doğrulanmadı)." },

  // ── Dolandırıcılık ──
  { id: "fraud-kod", cat: "fraud", sev: "critical", re: /dogrulama kodu|sms kodu|kredi karti bilgi|3d secure|guvenli odeme linki|odeme linki|link gonder|kod gonder/,
    msg: "Ödeme linki ya da doğrulama/SMS kodu isteniyor: klasik dolandırıcılık yöntemi.", action: "Hiçbir kod veya link paylaşmayın, görüşmeyi sonlandırın." },
  { id: "fraud-kapora", cat: "fraud", sev: "critical", re: /kapora|on odeme|onceden odeme|once havale|odemeyi once|parayi once|eft once|havale (yap|at) (sonra|kargo)/,
    msg: "Kapora/ön ödeme talebi var.", action: "Cihazı görmeden hiçbir ödeme yapmayın." },
  { id: "fraud-odeme-disi", cat: "fraud", sev: "high", re: /\biban\b|papara|ininal|\bhavale\b|\beft\b/,
    msg: "Platform dışı ödeme yöntemi (IBAN/havale) geçiyor; korumalı ödeme yerine tercih edilmiş olabilir.", action: "Mümkünse platformun korumalı ödeme yöntemini kullanın veya elden ödeyin." },
  { id: "fraud-platform-disi", cat: "fraud", sev: "medium", re: /ilan disinda|platform disinda|ilani silin|komisyon vermemek|sahibinden disinda/,
    msg: "Platform dışında anlaşma teklifi var." },
  { id: "fraud-kargo-only", cat: "fraud", sev: "medium", re: /sadece kargo|elden (vermem|veremem|teslim yok)|elden yok|yuz yuze (gorusemem|yok)|kargo(?:yla|ya)? (gonder|veririm|yaparim)/,
    msg: "Yalnızca kargo ile satış: cihaz ödemeden önce test edilemez.", action: "Elden teslim isteyin; olmuyorsa riski göz önünde bulundurun." },
  { id: "fraud-iade-yok", cat: "fraud", sev: "low", re: /\biade (?:yok\w*|edilmez|kabul edilmez|olmaz|yapilmaz|kabul etmem|kabul etmiyorum)/,
    msg: "İade/geri dönüş yok denmiş; sorun çıkarsa geri dönüş hakkı olmayabilir.", action: "Satın almadan önce tüm kontrolleri elden yapın." },
  { id: "fraud-hikaye", cat: "fraud", sev: "low", re: /yurt disinda|yurtdisindayim|askerim|\basker\b|tayinim|yurt disina gidiyorum|vefat|miras|ameliyat|bosanma|icra|buldum/,
    msg: "Mecburiyet/hikaye anlatımı var; tek başına kanıt değil ama dolandırıcılıkta sık kullanılır." },
  { id: "fraud-iletisim", cat: "fraud", sev: "low", re: /whatsapp|telegram|\bwp\b|signal|\bdm\b|ozelden yazin/,
    msg: "Platform dışı iletişim kanalına yönlendirme var." },
  { id: "fraud-elden-pozitif", cat: "fraud", sev: "ok", on: "flipped", re: /elden teslim|yerinde test|test edebilirsiniz|gorup alabilirsiniz|kargo yok/,
    msg: "Satıcı elden teslim/test imkanı beyan ediyor." },
];

const PRESSURE = /\bacil\b|hemen|bugun|son fiyat|pazarlik yok|ilk gelen|baska alici|cok ilgi|kacar|sira var/g;

// ───────────────────────── Yardımcılar ─────────────────────────

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function noisyOr(ps: number[]): number {
  return 1 - ps.reduce((acc, p) => acc * (1 - p), 1);
}

function parseBatteryFromText(t: string): number | null {
  const m = t.match(/(?:pil|batarya)(?: sagligi| kapasitesi| durumu| yuzde)?\s*[:=-]?\s*%?\s*(\d{2,3})\b/) ?? t.match(/%\s*(\d{2,3})\s*(?:pil|batarya)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 50 && n <= 100 ? n : null;
}

// ───────────────────────── Ana motor ─────────────────────────

export function buildRiskReport(input: RiskInput): RiskReport {
  const tags = input.tags ?? [];
  const has = (t: string) => tags.includes(t);
  const text = [input.title, input.sellerNote, input.description].filter(Boolean).join(" . ").slice(0, MAX_TEXT);
  const { flipped, stripped } = prepare(text);
  const isIphone = /iphone/.test(norm(input.model ?? ""));
  const signals: RiskSignal[] = [];
  const push = (s: RiskSignal) => signals.push(s);

  // 1) Kural tablosu
  for (const r of RULES) {
    const body = r.on === "flipped" ? flipped : stripped;
    if (r.re.test(body)) {
      push({ id: r.id, category: r.cat, severity: r.sev, message: r.msg, basis: "ilan metni", action: r.action, negotiation: r.neg });
    }
  }
  const fired = (id: string) => signals.some((s) => s.id === id);

  // 2) IMEI
  const imeiRaw = input.imei ?? (/imei/.test(flipped) ? text.match(/\b\d{15}\b/)?.[0] : null) ?? null;
  const imei = validateImei(imeiRaw);
  if (imei) {
    if (!imei.valid) {
      const lenOnly = imei.digits.length !== 15;
      push({ id: "imei-gecersiz", category: "imei", severity: lenOnly ? "medium" : "critical", message: imei.reason, basis: "hesaplandı", action: "IMEI'yi cihazda *#06# ile tekrar okuyun ve kutu etiketiyle karşılaştırın." });
    } else {
      push({ id: "imei-gecerli", category: "imei", severity: "ok", message: imei.reason, basis: "hesaplandı", action: "e-Devlet IMEI sorgusuyla kayıt ve engel durumunu doğrulayın." });
    }
  }

  // 3) Elden doğrulama sonuçları
  const c = input.checks ?? {};
  const chk = (v: boolean | null | undefined, cat: RiskCategoryId, id: string, bad: string, good: string, badSev: Severity = "critical") => {
    if (v === false) push({ id, category: cat, severity: badSev, message: bad, basis: "elde doğrulandı" });
    else if (v === true) push({ id, category: cat, severity: "ok", message: good, basis: "elde doğrulandı" });
  };
  chk(c.imeiMatchesBox, "imei", "chk-imei-kutu", "Cihazdaki IMEI kutu/fatura etiketiyle uyuşmuyor.", "Cihaz IMEI'si kutu/fatura etiketiyle eşleşti.");
  chk(c.imeiRegistered, "imei", "chk-imei-kayit", "e-Devlet sorgusunda cihaz kayıtlı/engelsiz görünmüyor.", "e-Devlet sorgusunda cihaz kayıtlı ve engelsiz görünüyor.");
  chk(c.accountsRemoved, "imei", "chk-hesap", "Hesap/kilit cihazdan kaldırılmamış.", "Hesap ve kilit cihazdan kaldırıldı, cihaz sıfırlandı.");
  chk(c.screenTestPassed, "screen", "chk-ekran", "Ekran testinde sorun bulundu.", "Ekran ve dokunmatik testi sorunsuz geçti.", "high");
  chk(c.partsHistoryClean, "parts", "chk-parca", "Parça geçmişinde sorun/bilinmeyen parça var.", "Parça geçmişi temiz görünüyor.", "high");
  chk(c.warrantyVerified, "warranty", "chk-garanti", "Seri numarasıyla garanti doğrulanamadı.", "Garanti seri numarasıyla doğrulandı.", "high");

  // 4) Etiketler (kullanıcı beyanı)
  if (has("Çizikler Var")) push({ id: "tag-cizik", category: "screen", severity: "low", message: "Belirgin çizikler beyan edilmiş.", basis: "kullanıcı beyanı", negotiation: "Belirgin çizikler pazarlıkta düşülebilir." });
  else if (has("Ufak Çizikler Var")) push({ id: "tag-ufak-cizik", category: "screen", severity: "ok", message: "Yalnızca ufak çizik beyan edilmiş.", basis: "kullanıcı beyanı" });
  if (has("Face ID / True Tone Aktif")) push({ id: "tag-faceid", category: "screen", severity: "ok", message: "Face ID/True Tone aktif beyan edilmiş (doğrulanmadı).", basis: "kullanıcı beyanı" });
  if (has("Değişensiz / Orijinal")) push({ id: "tag-orijinal", category: "parts", severity: "ok", message: "Değişen parça yok beyan edilmiş (doğrulanmadı).", basis: "kullanıcı beyanı" });
  if (has("Kutulu & Faturalı")) push({ id: "tag-kutu", category: "warranty", severity: "ok", message: "Kutu ve fatura beyan edilmiş.", basis: "kullanıcı beyanı" });
  if (has("Garantisi Var")) push({ id: "tag-garanti", category: "warranty", severity: "ok", message: "Garanti devam ediyor beyan edilmiş (doğrulanmadı).", basis: "kullanıcı beyanı", action: "Seri numarasıyla üreticinin garanti sorgulama sayfasından doğrulayın (Apple için checkcoverage.apple.com)." });
  if (has("Pil Değişmiş")) push({ id: "tag-pil-degismis", category: "battery", severity: "low", message: "Pil değiştirilmiş beyan edilmiş; parçanın orijinalliği belirsiz.", basis: "kullanıcı beyanı", action: "Servis kaydı ve parça orijinalliğini sorun." });

  // Çelişkiler
  if (has("Değişensiz / Orijinal") && has("Pil Değişmiş")) {
    push({ id: "celiski-parca-pil", category: "parts", severity: "medium", message: "'Değişensiz/Orijinal' ve 'Pil Değişmiş' birlikte seçili: beyanlar çelişiyor.", basis: "hesaplandı" });
  }
  if (has("Değişensiz / Orijinal") && signals.some((s) => s.category === "parts" && s.basis === "ilan metni" && SEV_RANK[s.severity] >= SEV_RANK.medium)) {
    push({ id: "celiski-parca-metin", category: "parts", severity: "medium", message: "Değişen parça yok beyanı ilan metniyle çelişiyor.", basis: "hesaplandı" });
  }

  // 5) Pil sayısal değerlendirme
  const textPct = parseBatteryFromText(stripped);
  const pct = input.batteryHealthPct ?? textPct;
  const pctBasis: SignalBasis = input.batteryHealthPct != null ? "kullanıcı beyanı" : "ilan metni";
  const batteryReplaced = has("Pil Değişmiş") || fired("pil-degismis");
  if (pct != null) {
    const base = { category: "battery" as const, basis: pctBasis };
    if (pct >= 90) push({ ...base, id: "pil-yuksek", severity: "ok", message: `Pil sağlığı %${pct} (beyan, elde doğrulayın).` });
    else if (pct >= 85) push({ ...base, id: "pil-iyi", severity: "low", message: `Pil sağlığı %${pct}: kabul edilebilir, yakın zamanda düşebilir.` });
    else if (pct >= 80) push({ ...base, id: "pil-sinir", severity: "medium", message: `Pil sağlığı %${pct}: değişim eşiğine yakın.`, negotiation: "Pil değişim maliyetini pazarlıkta düşün." });
    else push({ ...base, id: "pil-dusuk", severity: "high", message: `Pil sağlığı %${pct}: değişim gerekebilir.`, negotiation: "Pil değişim maliyeti pazarlıkta mutlaka düşülmeli." });
    if (has("Pil %85+") && pct < 85) push({ category: "battery", id: "celiski-pil", severity: "medium", message: `'Pil %85+' etiketi seçili ama pil %${pct}.`, basis: "hesaplandı" });
    if (!batteryReplaced && pct >= 95 && (input.usageMonths ?? 0) >= 36) {
      push({ category: "battery", id: "pil-sasirtici", severity: "medium", message: `${input.usageMonths} aylık kullanımda %${pct} pil olağan dışı; pil değişmiş ya da değer hatalı olabilir.`, basis: "hesaplandı", action: "Pil değerini Ayarlar ekranından kendiniz okuyun." });
    }
  } else if (has("Pil %85+")) {
    push({ category: "battery", id: "pil-etiket", severity: "unknown", message: "Pil %85+ deniyor ama gerçek yüzde belirtilmemiş.", basis: "kullanıcı beyanı", action: "Gerçek pil yüzdesini Ayarlar'dan okuyun." });
  }

  // 6) Dolandırıcılık: bileşik ve fiyat sinyalleri
  const pressureHits = new Set(stripped.match(PRESSURE) ?? []);
  if (pressureHits.size >= 2) push({ id: "fraud-baski", category: "fraud", severity: "medium", message: "Birden fazla acele/baskı ifadesi var (acil, hemen, son fiyat gibi).", basis: "ilan metni", action: "Acele etmeyin; baskı altında karar vermeyin." });
  else if (pressureHits.size === 1) push({ id: "fraud-baski", category: "fraud", severity: "low", message: "Acele/baskı ifadesi var.", basis: "ilan metni" });

  const prepay = fired("fraud-kapora") || fired("fraud-odeme-disi");
  const cargoOnly = fired("fraud-kargo-only") || input.deliveryType === "kargo";
  if (prepay && cargoOnly) push({ id: "fraud-kombo", category: "fraud", severity: "critical", message: "Ön ödeme/havale + yalnızca kargo: en sık görülen dolandırıcılık kalıbı.", basis: "hesaplandı", action: "Para göndermeyin." });
  if (input.deliveryType === "kargo" && !fired("fraud-kargo-only")) push({ id: "fraud-kargo-only", category: "fraud", severity: "medium", message: "Yalnızca kargo ile teslim: cihaz ödemeden önce test edilemez.", basis: "kullanıcı beyanı", action: "Elden teslim isteyin." });
  if (input.deliveryType === "elden" || input.deliveryType === "ikisi") push({ id: "fraud-elden", category: "fraud", severity: "ok", message: "Elden teslim imkanı var; cihazı görerek test edebilirsiniz.", basis: "kullanıcı beyanı" });

  const price = input.listingPrice ?? null;
  const med = input.marketMedian ?? null;
  if (price && med && med > 0) {
    const ratio = price / med;
    if (ratio < 0.6) push({ id: "fraud-fiyat", category: "fraud", severity: "high", message: `İlan fiyatı piyasa medyanının %${Math.round(ratio * 100)}'i: aşırı ucuz (sahte ilan, kilitli/arızalı cihaz riski).`, basis: "hesaplandı", action: "Cihazı görmeden hiçbir ödeme yapmayın." });
    else if (ratio < 0.75) push({ id: "fraud-fiyat", category: "fraud", severity: "medium", message: `İlan fiyatı piyasa medyanının %${Math.round(ratio * 100)}'i: belirgin ucuz, nedenini sorgulayın.`, basis: "hesaplandı" });
  }

  // 7) Eksik bilgi sinyalleri (kategori başına, kanıt yoksa)
  const evidence = (cat: RiskCategoryId) => signals.some((s) => s.category === cat && s.basis !== "eksik bilgi" && s.severity !== "unknown");
  const unknownMsg: Partial<Record<RiskCategoryId, string>> = {
    imei: "IMEI/kilit durumu hakkında bilgi yok.",
    screen: "Ekran durumu hakkında bilgi yok.",
    battery: "Pil sağlığı hakkında bilgi yok.",
    parts: "Parça değişimi/tamir geçmişi hakkında bilgi yok.",
    warranty: "Garanti ve fatura durumu hakkında bilgi yok.",
  };
  for (const cat of CAT_ORDER) {
    if (cat === "fraud") continue;
    if (!evidence(cat)) push({ id: `eksik-${cat}`, category: cat, severity: "unknown", message: unknownMsg[cat]!, basis: "eksik bilgi" });
  }

  // 8) Kategori skorları
  const categories = {} as Record<RiskCategoryId, CategoryRisk>;
  for (const cat of CAT_ORDER) {
    const list = signals.filter((s) => s.category === cat).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
    const score = Math.round(clamp(noisyOr(list.map((s) => SEV_P[s.severity])) * 100, 0, 100));
    categories[cat] = { id: cat, label: CAT_LABEL[cat], score, level: levelOf(score), signals: list, hasEvidence: evidence(cat) || (cat === "fraud" && list.length > 0) };
  }

  const criticalFlags = signals.filter((s) => s.severity === "critical");
  let overallScore = Math.round(noisyOr(CAT_ORDER.map((cat) => (CAT_WEIGHT[cat] * categories[cat].score) / 100)) * 100);
  if (criticalFlags.length > 0) overallScore = Math.max(overallScore, 70);
  overallScore = clamp(overallScore, 0, 100);
  const level = overallLevelOf(overallScore);

  const completeness = Math.round((CAT_ORDER.filter((cat) => categories[cat].hasEvidence).length / CAT_ORDER.length) * 100) / 100;

  // 9) Tavsiye
  let advice: Advice;
  if (criticalFlags.length > 0 || overallScore >= 65) advice = "kacin";
  else if (overallScore >= 40 || completeness < 0.34) advice = "elden_dogrula";
  else if (overallScore >= 20 || completeness < 0.67) advice = "dikkatli_al";
  else advice = "makul";
  const adviceText: Record<Advice, string> = {
    kacin: "Ciddi risk işareti var. Bu sorun çözülüp doğrulanmadan para göndermeyin ve cihazı almayın.",
    elden_dogrula: "Belirgin riskler ya da çok eksik bilgi var. Satın almadan önce aşağıdaki kontrolleri elden yapın.",
    dikkatli_al: "Büyük bir engel görünmüyor ama doğrulanmamış beyanlar var. Elden kontrol listesini uygulayın.",
    makul: "Görünen risk düşük. Yine de IMEI ve hesap kontrolünü elden yapın.",
  };

  const topRisks = signals.filter((s) => SEV_RANK[s.severity] >= SEV_RANK.medium).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]).slice(0, 5);
  const positives = signals.filter((s) => s.severity === "ok");
  const unknowns = signals.filter((s) => s.severity === "unknown");

  // 10) Elden kontrol listesi
  const baseItems: Record<RiskCategoryId, string[]> = {
    imei: [
      "*#06# ile IMEI'yi açın; Ayarlar > Genel > Hakkında'daki ve kutu/fatura etiketindeki IMEI ile aynı mı kontrol edin.",
      "e-Devlet IMEI sorgusunda cihazın kayıtlı ve engelsiz olduğunu doğrulayın.",
      "iCloud/Google hesabından çıkış yapıldığını, Bul özelliğinin kapalı olduğunu ve cihazın sizin önünüzde sıfırlandığını görün.",
    ],
    fraud: [
      "Ödemeyi yalnızca cihazı elinize alıp test ettikten sonra yapın; kapora, ön ödeme ve kod/link paylaşmayın.",
      "Satıcının kimliğinin ilan sahibiyle eşleştiğini kontrol edin; mümkünse kalabalık bir yerde buluşun.",
    ],
    parts: [
      isIphone ? "Ayarlar > Genel > Hakkında > Parçalar ve Servis Geçmişi bölümünü (destekleniyorsa) açıp bilinmeyen parça uyarısı var mı bakın." : "Kasa aralıklarına, vidalara ve bağlantı noktalarına bakıp açılıp kapanmış izi arayın.",
      "Ön/arka kamerayı, hoparlör ve mikrofonu, şarj soketini ve SIM tepsisini (oksit izi) test edin.",
    ],
    screen: [
      "Beyaz, siyah, kırmızı ve yeşil tam ekran renk testi yapın; ölü piksel, leke, yanık ve çizgi arayın.",
      "Dokunmatiği tüm kenar ve köşelerde test edin; Face ID/parmak izi ve otomatik parlaklığı deneyin.",
    ],
    battery: [
      isIphone ? "Ayarlar > Pil > Pil Sağlığı ve Şarj ekranında maksimum kapasiteyi ve servis uyarısını kendiniz okuyun." : "Pil sağlığı çoğu Android'de görünmez: şarj hızı, ısınma ve boşalma hızını birkaç dakika gözlemleyin.",
      "Şarja takıp ısınma ve şarj hızını izleyin.",
    ],
    warranty: [
      "Seri numarasıyla üreticinin garanti sorgulamasını yapın (Apple için checkcoverage.apple.com); fatura ve kutudaki seri/IMEI ile eşleştirin.",
    ],
  };
  const items: ChecklistItem[] = [];
  for (const cat of CAT_ORDER) {
    const cr = categories[cat];
    const bump: 1 | 2 | 3 = cr.level === "kritik" || cr.level === "yuksek" ? 1 : cat === "imei" || cat === "fraud" || !cr.hasEvidence ? 1 : cr.level === "orta" ? 2 : 3;
    baseItems[cat].forEach((itemText, i) => items.push({ id: `${cat}-${i}`, category: cat, text: itemText, priority: bump }));
    cr.signals.filter((s) => s.action && SEV_RANK[s.severity] >= SEV_RANK.low).forEach((s, i) =>
      items.push({ id: `${s.id}-a${i}`, category: cat, text: s.action!, priority: SEV_RANK[s.severity] >= SEV_RANK.high ? 1 : 2 })
    );
  }
  const seen = new Set<string>();
  const handoverChecklist = items
    .sort((a, b) => a.priority - b.priority || CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category))
    .filter((it) => {
      const k = norm(it.text).slice(0, 40);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 14);

  const negotiationPoints = [...new Set(signals.map((s) => s.negotiation).filter((x): x is string => !!x))].slice(0, 6);

  const topNames = topRisks.slice(0, 3).map((s) => s.message.replace(/\.$/, ""));
  const summary =
    `Genel risk: ${LEVEL_LABEL[level]} (${overallScore}/100).` +
    (topNames.length ? ` Öne çıkanlar: ${topNames.join("; ")}.` : " Belirgin bir risk işareti görünmüyor.") +
    (completeness < 0.67 ? " Birçok kategoride bilgi eksik; düşük skor güvenli olduğu anlamına gelmez." : "");

  return {
    overall: { score: overallScore, level, label: LEVEL_LABEL[level] },
    advice,
    adviceText: adviceText[advice],
    summary,
    categories,
    criticalFlags,
    topRisks,
    positives,
    unknowns,
    handoverChecklist,
    negotiationPoints,
    dataCompleteness: completeness,
    imei,
    disclaimers: [
      "Bu analiz ilan metnine ve girdiğiniz bilgilere dayanır; satıcı beyanları doğrulanmış sayılmaz.",
      "IMEI biçim doğrulaması cihazın kayıtlı ya da engelsiz olduğunu göstermez; e-Devlet sorgusu gerekir.",
    ],
  };
}