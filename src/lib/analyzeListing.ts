import { evaluatePhonePrice } from "@/lib/evaluatePrice";
import {
  PHONE_PRICE_TABLE,
  PRICE_TABLE_UPDATED_AT,
} from "@/lib/phonePrices";
import type { AnalysisResult, PriceVerdict } from "@/types/analysis";

const RECOMMENDATIONS: Record<PriceVerdict, string> = {
  great_deal:
    "Fiyat piyasa aralığının altında. Çok ucuz fiyat sahtekârlık ya da gizli sorun işareti olabilir, kontrol listesini mutlaka uygula.",
  fair: "Fiyat piyasa aralığında. Kontrol listesini uygula ve pazarlık payı olup olmadığını sor.",
  expensive:
    "Fiyat piyasa aralığının üstünde. Pazarlık yap ya da başka ilanlara bak.",
  unknown:
    "Bu model için fiyat verisi yok, fiyat değerlendirmesi yapılamadı. Kontrol listesini uygula.",
};

export function analyzeListing(
  modelId: string,
  listingPrice: number,
): AnalysisResult | null {
  const entry = PHONE_PRICE_TABLE.find((item) => item.id === modelId);
  if (!entry) return null;

  const evaluation = evaluatePhonePrice(modelId, listingPrice);
  const updated = PRICE_TABLE_UPDATED_AT
    ? ` (güncelleme: ${PRICE_TABLE_UPDATED_AT})`
    : "";

  return {
    isDemo: false,
    category: "phone",
    productName: entry.name,
    storage: entry.storage,
    listingPrice,
    marketPrice: evaluation.marketPrice,
    verdict: evaluation.verdict,
    recommendation: RECOMMENDATIONS[evaluation.verdict],
    confidence: null,
    sources: evaluation.marketPrice
      ? [`Başlangıç tahmini fiyat tablosu${updated}`]
      : [],
  };
}