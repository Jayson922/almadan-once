export type PriceVerdict = "ÇOK_PAHALI" | "PAHALI" | "UYGUN" | "ÇOK_UYGUN";

export interface AnalysisResult {
  phoneName: string;
  storage: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  verdict: PriceVerdict | string;
  recommendation: string;
  updatedAt?: string;
}