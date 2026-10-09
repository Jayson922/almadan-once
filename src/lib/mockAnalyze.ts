import type { AnalysisResult } from "@/types/analysis";

export async function mockAnalyze(): Promise<AnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    isDemo: true,
    category: "phone",
    productName: "Apple iPhone 15",
    storage: "128 GB",
    listingPrice: 35000,
    marketPrice: { min: 37000, max: 40000, currency: "TRY" },
    verdict: "fair",
    recommendation: "Satın almadan önce pazarlık yap.",
    confidence: null,
    sources: [],
  };
}