export type PriceVerdict = "great_deal" | "fair" | "expensive" | "unknown";

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface AnalysisResult {
  isDemo: boolean;
  category: string;
  productName: string;
  storage?: string;
  listingPrice: number;
  marketPrice: PriceRange | null;
  verdict: PriceVerdict;
  recommendation: string;
  confidence: number | string | null;
  sources: unknown[];
  updatedAt?: string;
}
export type { TeknikDeğerlendirme, KronikSorun, ExpertiseReport, ListingInputPayload } from './report';
