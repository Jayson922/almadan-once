import { PHONE_PRICE_TABLE } from "@/lib/phonePrices";
import type { PriceRange, PriceVerdict } from "@/types/analysis";

export interface PriceEvaluation {
  verdict: PriceVerdict;
  marketPrice: PriceRange | null;
}

export function evaluatePhonePrice(
  modelId: string,
  listingPrice: number,
): PriceEvaluation {
  const entry = PHONE_PRICE_TABLE.find((item) => item.id === modelId);

  if (!entry || entry.minPrice === null || entry.maxPrice === null) {
    return { verdict: "unknown", marketPrice: null };
  }

  const marketPrice: PriceRange = {
    min: entry.minPrice,
    max: entry.maxPrice,
    currency: "TRY",
  };

  if (listingPrice < entry.minPrice) {
    return { verdict: "great_deal", marketPrice };
  }
  if (listingPrice <= entry.maxPrice) {
    return { verdict: "fair", marketPrice };
  }
  return { verdict: "expensive", marketPrice };
}