import { evaluatePhonePrice } from "@/lib/evaluatePrice";
import { PHONE_PRICE_TABLE, PRICE_TABLE_UPDATED_AT } from "@/lib/phonePrices";
import type { AnalysisResult, PriceVerdict } from "@/types/analysis";

const RECOMMENDATIONS: Record<PriceVerdict, string> = {
  ÇOK_PAHALI: "Piyasanın çok üzerinde. Farklı ilanlara yönelmeniz tavsiye edilir.",
  PAHALI: "Piyasa ortalamasının üzerinde. Pazarlık yapmayı deneyebilirsiniz.",
  UYGUN: "Fiyat piyasa aralığında. Kontrol listesini uygula ve pazarlık payı olup olmadığını sor.",
  ÇOK_UYGUN: "Piyasa ortalamasının altında. Cihazın durumunu ve faturasını dikkatlice inceleyin.",
};

export function analyzeListing(modelId: string, price: number): AnalysisResult {
  const item = PHONE_PRICE_TABLE.find((p) => p.id === modelId);

  if (!item) {
    return {
      phoneName: "Bilinmeyen Model",
      storage: "-",
      price: price || 0,
      minPrice: 0,
      maxPrice: 0,
      verdict: "PAHALI",
      recommendation: "Model veritabanında bulunamadı.",
      updatedAt: PRICE_TABLE_UPDATED_AT,
    };
  }

  const numericPrice = Number(price) || 0;
  const verdict = evaluatePhonePrice(numericPrice, item.minPrice, item.maxPrice);

  return {
    phoneName: item.name,
    storage: item.storage,
    price: numericPrice,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    verdict,
    recommendation: RECOMMENDATIONS[verdict] ?? "Fiyat değerlendirmesi yapıldı.",
    updatedAt: item.updatedAt ?? PRICE_TABLE_UPDATED_AT,
  };
}