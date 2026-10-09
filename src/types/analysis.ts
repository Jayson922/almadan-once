export type ListingCategory = "phone";

export type PriceVerdict = "great_deal" | "fair" | "expensive" | "unknown";

export interface PriceRange {
  min: number;
  max: number;
  currency: "TRY";
}

export interface AnalysisResult {
  /** Gerçek veriyle üretilmediyse true. Arayüzdeki DEMO uyarısı buna bağlı. */
  isDemo: boolean;
  category: ListingCategory;
  productName: string;
  storage?: string;
  listingPrice: number;
  marketPrice: PriceRange;
  verdict: PriceVerdict;
  recommendation: string;
  /** 0 ile 1 arası güven değeri, bilinmiyorsa null. */
  confidence: number | null;
  /** Fiyatın dayandığı veri kaynakları. Demo'da boş. */
  sources: string[];
}