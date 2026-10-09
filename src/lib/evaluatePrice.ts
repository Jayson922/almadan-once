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

  if (!entry || entry.min === null || entry.max === null) {
    return { verdict: "unknown", marketPrice: null };
  }

  const marketPrice: PriceRange = {
    min: entry.min,
    max: entry.max,
    currency: "TRY",
  };

  if (listingPrice < entry.min) {
    return { verdict: "great_deal", marketPrice };
  }
  if (listingPrice <= entry.max) {
    return { verdict: "fair", marketPrice };
  }
  return { verdict: "expensive", marketPrice };
}