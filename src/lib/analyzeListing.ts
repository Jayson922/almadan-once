import { evaluatePhonePrice } from "@/lib/evaluatePrice";
import { PHONE_PRICE_TABLE, PRICE_TABLE_UPDATED_AT } from "@/lib/phonePrices";
import type { AnalysisResult, PriceVerdict } from "@/types/analysis";

const RECOMMENDATIONS: Record<PriceVerdict, string> = {
  great_deal:
    "Fiyat piyasa aralığının altında. Cihazın durumunu, faturasını ve parça değişimi olup olmadığını dikkatlice kontrol edin.",
  fair:
    "Fiyat piyasa aralığında. Kontrol listesini uygulayın ve pazarlık payı olup olmadığını sorun.",
  expensive:
    "Fiyat piyasa aralığının üzerinde. Pazarlık yapın ya da farklı ilanlara bakın.",
  unknown:
    "Bu model için fiyat verimiz yok. Benzer ilanları elle karşılaştırarak karar verin.",
};

/** "25.000", "25000 TL" ya da 25000 gibi girdileri güvenle sayıya çevirir. */
function parsePrice(value: number | string): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function analyzeListing(
  modelId: string,
  price: number | string,
): AnalysisResult {
  const listingPrice = parsePrice(price);
  const item = PHONE_PRICE_TABLE.find((p) => p.id === modelId);
  const { verdict, marketPrice } = evaluatePhonePrice(modelId, listingPrice);

  // Fiyat girilmediyse karar üretme.
  const finalVerdict: PriceVerdict = listingPrice > 0 ? verdict : "unknown";

  return {
    isDemo: false,
    category: "smartphone",
    productName: item?.name ?? "Bilinmeyen Model",
    storage: item?.storage,
    listingPrice,
    marketPrice,
    verdict: finalVerdict,
    recommendation:
      listingPrice > 0
        ? RECOMMENDATIONS[finalVerdict]
        : "Karşılaştırma için ilan fiyatını girin.",
    confidence: marketPrice ? "Tablo bazlı tahmin" : null,
    sources: marketPrice
      ? [{ name: "Dahili fiyat tablosu", updatedAt: item?.updatedAt ?? PRICE_TABLE_UPDATED_AT }]
      : [],
    updatedAt: item?.updatedAt ?? PRICE_TABLE_UPDATED_AT,
  };
}