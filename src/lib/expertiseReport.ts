import type {
  ExpertiseCategory,
  ExpertiseReport,
  ListingInputPayload,
} from '@/types/report';
import { getAdvancedExpertiseEngine } from './chronicIssuesEngine';
import { analyzeFraudRisk } from './fraudDetection';

/** Türkçe karakterleri ve büyük/küçük harf farkını ortadan kaldırır. */
function fold(input: string): string {
  return input
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const CATEGORY_RULES: Array<[ExpertiseCategory, RegExp]> = [
  ['smartphone', /\b(iphone|galaxy|samsung|xiaomi|redmi|poco|huawei|oppo|realme|pixel|telefon)\b/],
  ['laptop', /\b(laptop|macbook|notebook|thinkpad|dizustu)\b/],
  ['automotive', /\b(araba|otomobil|bmw|mercedes|renault|tofas|fiat|volkswagen|ford|toyota)\b/],
  ['appliance', /\b(buzdolabi|camasir|bulasik|firin|klima|supurge)\b/],
];

const BRAND_RULES: Array<[RegExp, string]> = [
  [/\b(iphone|ipad|macbook|apple)\b/, 'Apple'],
  [/\b(galaxy|samsung)\b/, 'Samsung'],
  [/\b(xiaomi|redmi|poco)\b/, 'Xiaomi'],
  [/\b(huawei)\b/, 'Huawei'],
  [/\b(lenovo|thinkpad)\b/, 'Lenovo'],
  [/\b(bmw)\b/, 'BMW'],
  [/\b(mercedes)\b/, 'Mercedes'],
  [/\b(renault)\b/, 'Renault'],
];

function detectCategory(folded: string): ExpertiseCategory {
  for (const [category, rule] of CATEGORY_RULES) {
    if (rule.test(folded)) return category;
  }
  return 'general';
}

function detectBrand(folded: string, original: string): string {
  for (const [rule, brand] of BRAND_RULES) {
    if (rule.test(folded)) return brand;
  }
  return original.trim().split(/\s+/)[0] || 'Genel';
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 0-100: medyanın %20 altı = 100, medyan = 50, medyanın %20 üstü = 0 */
function scoreAgainstMarket(price: number, min: number, max: number): number {
  const median = (min + max) / 2;
  if (median <= 0) return 0;
  const discount = (median - price) / median;
  return Math.round(clamp(50 + discount * 250, 0, 100));
}

export async function buildExpertiseReport(
  payload: ListingInputPayload
): Promise<ExpertiseReport> {
  const modelName = payload.modelName?.trim() || 'Bilinmeyen Ürün';
  const rawPrice = Number(payload.price);
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  const notes = payload.notes ?? '';
  const features = payload.features ?? [];

  const folded = fold(modelName);
  const category = detectCategory(folded);
  const brand = detectBrand(folded, modelName);

  const expertise = getAdvancedExpertiseEngine(brand, modelName, category);

  const market =
    payload.marketPrice && payload.marketPrice.max >= payload.marketPrice.min
      ? payload.marketPrice
      : null;

  const score = market && price > 0 ? scoreAgainstMarket(price, market.min, market.max) : null;

  // Piyasa verisi yoksa fiyat anomalisi tetiklenmesin diye referans olarak ilan fiyatı verilir.
  const fraud = analyzeFraudRisk(notes, price, market ? market.min : price);

  let tavsiye: string;
  if (fraud.riskScore >= 60) {
    tavsiye = 'Yüksek dolandırıcılık riski: ödeme yapmadan önce satıcıyı ve ürünü doğrulayın';
  } else if (score === null) {
    tavsiye = 'Piyasa verisi yok: karar için benzer ilanlarla karşılaştırın';
  } else if (score >= 75) {
    tavsiye = 'Fiyat piyasanın altında: iyi fırsat olabilir, elden kontrolü atlamayın';
  } else if (score >= 40) {
    tavsiye = 'Fiyat piyasa aralığında: pazarlık payı aranabilir';
  } else {
    tavsiye = 'Fiyat piyasanın üzerinde: pazarlık yapın ya da alternatiflere bakın';
  }

  const query = encodeURIComponent(modelName);

  return {
    arbitrajSkoru: score,
    tavsiye,
    tahminiPiyasaMin: market ? market.min : null,
    tahminiPiyasaMax: market ? market.max : null,
    yonlendirmeTavsiyeleri: [
      {
        platform: 'Google Arama & Alışveriş',
        url: `https://www.google.com/search?q=${encodeURIComponent(modelName + ' ikinci el fiyatları')}`,
        aciklama: 'Güncel fiyatları, incelemeleri ve alternatif ilanları karşılaştırın.',
      },
      {
        platform: 'Sahibinden',
        url: `https://www.sahibinden.com/kelime-arama?query=${query}`,
        aciklama: 'Benzer ilanların güncel fiyat bantlarını kontrol edin.',
      },
    ],
    teknikDeğerlendirme: {
      markaModelVaryant: modelName,
      güçlüYönler: [
        market
          ? 'Fiyat, elimizdeki piyasa aralığıyla karşılaştırıldı'
          : 'Piyasa karşılaştırması için ek veri girilebilir',
        ...features.slice(0, 2),
      ],
      zayıfYönler: [
        'İkinci el kullanıma bağlı kozmetik ve donanımsal yıpranma olabilir',
        'Satıcı beyanları elden teslimde fiziksel olarak doğrulanmalı',
      ],
      kronikSorunlar: expertise.chronicRisks.map((r) => ({
        sorun: r.issue,
        riskSeviyesi: r.riskLevel,
        açıklama: r.description,
      })),
      tahminiKalanÖmürYıl: expertise.estimatedRemainingLifespanYears,
      tamirEdilebilirlikPuanı: expertise.repairability.repairabilityScore,
      görselKusurlar: [],
      doğrulanamayanİddialar: [
        {
          iddia: 'Parça değişimi olmadığı / orijinal olduğu beyanı',
          eldenKontrolTavsiyesi:
            'Teslim alırken yetkili serviste ya da bir uzmana kontrol ettirin.',
        },
      ],
      kozmetikDurum:
        'Görsel analiz henüz yapılmadı; kozmetik durum elden kontrolle belirlenmeli.',
      donanımDurum: `Kategori: ${category}. Marka bazlı tahmini kalan ömür ~${expertise.estimatedRemainingLifespanYears} yıl.`,
      fiyatMantigi: market
        ? `İstenen fiyat ${price} TL, piyasa aralığı ${market.min} - ${market.max} TL.`
        : 'Piyasa aralığı verilmediği için fiyat değerlendirmesi yapılmadı.',
    },
    riskRaporu: [
      `Dolandırıcılık risk seviyesi: ${fraud.riskLevel} (skor: ${fraud.riskScore}/100)`,
      ...fraud.warnings,
      ...fraud.recommendations,
      ...(expertise.chronicRisks.length > 0
        ? [`Teknik risk: ${expertise.chronicRisks.map((c) => c.issue).join(', ')} konularına dikkat edin.`]
        : []),
    ],
  };
}