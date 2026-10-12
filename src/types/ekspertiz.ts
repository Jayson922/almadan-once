// src/types/ekspertiz.ts
// Canlı /api/ekspertiz rotasının döndürdüğü rapor şeması. ReportView ve rota bu tipi paylaşır.
// Eski tipler (analysis.ts, report.ts) bu dosyadan bağımsızdır; birleştirme ayrı bir görevdir.

import type { Decision, PriceRange, ValuationBasis, Verdict } from "@/lib/valuation";

export type EkspertizCondition = "like_new" | "good" | "fair" | "poor";

export type DeviceCategory = "smartphone" | "laptop" | "automotive" | "general";

export type TechStatus = "doğrulandı" | "tahmini" | "bulunamadı";

/** Bir bilginin nereden geldiği. Ölçülmüş gibi sunulmamalıdır. */
export type EstimateBasis = "kullanıcı beyanı" | "model bilgisinden tahmin" | "doğrulanamadı";

export type MetricRisk = "Düşük" | "Orta" | "Yüksek" | "Bilinmiyor";

export type DeliveryType = "kargo" | "elden" | "ikisi";

/**
 * Sapma bandı (ilan fiyatının medyana göre yüzdesi):
 * much_below: -20 ve altı, below: -20 ile -5 arası, near: -5 ile +5 arası,
 * above: +5 ile +20 arası, much_above: +20 ve üstü.
 */
export type DeviationBand = "much_below" | "below" | "near" | "above" | "much_above";

export type PartAvailability = "yaygın" | "orta" | "sınırlı" | "bilinmiyor";

export type PartEase = "kolay" | "orta" | "zor" | "bilinmiyor";

export type AlternativesStatus = "found" | "none_found" | "insufficient_data";

/** live: gerçek ilanlarla hesaplandı. estimated: yeterli gerçek ilan yok. */
export type DataMode = "live" | "estimated";

/**
 * Canlı arama adımının sonucu:
 * ok: ilan bulundu, no_listings: arama çalıştı ama ilan çıkmadı,
 * quota: yapay zeka kotası doldu, timeout: zaman aşımı, error: başka hata.
 */
export type SearchStatus = "ok" | "no_listings" | "quota" | "timeout" | "error";

/** İlan satırlarının nasıl ayrıştırıldığı: code (kural tabanlı), ai (yedek çıkarma), none (ilan yok). */
export type ParseMode = "code" | "ai" | "none";

export interface TechItem {
  area: string;
  finding: string;
  status: TechStatus;
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface EkspertizIdentity {
  brand: string | null;
  series: string | null;
  releaseYear: number | null;
  storage: string | null;
  condition: EkspertizCondition;
  conditionLabel: string;
  hasBox: boolean;
  hasWarranty: boolean;
  /** Kullanıcı beyanı; girilmediyse null */
  batteryHealthPct: number | null;
  /** Kullanıcı beyanı; girilmediyse null */
  usageMonths: number | null;
}

export interface BargainingPlan {
  targetOffer: number;
  walkAwayPrice: number;
  tactics: string[];
}

/** İlan fiyatının piyasa aralığına göre sapma matrisi (yüzde, bir ondalık). Veri yoksa alanlar null. */
export interface PriceDeviation {
  vsMedianPct: number | null;
  vsMinPct: number | null;
  vsMaxPct: number | null;
  band: DeviationBand | null;
}

export interface HardwareMetric {
  id: string;
  label: string;
  value: string;
  risk: MetricRisk;
  basis: EstimateBasis;
  rationale: string;
}

export interface ModularityItem {
  part: string;
  ease: PartEase;
  note: string;
}

export interface RepairabilityDetail {
  /** 1-10; tahmin edilemiyorsa null */
  score: number | null;
  scoreBasis: EstimateBasis;
  modularity: ModularityItem[];
  partAvailability: PartAvailability;
  partAvailabilityNote: string;
  summary: string;
}

/** Taranan havuzdaki ilan sayısı (süzgeçten önce), kaynak adına göre. Yalnızca gerçekten gelen kaynaklar listelenir. */
export interface PlatformStat {
  name: string;
  receivedCount: number;
}

/**
 * Şeffaf veri dayanağı. ValuationBasis'in tüm alanlarını (elenen kalemler, IQR ayrıntıları,
 * eşleşen ilanlar) içerir; rota arama durumu, kaynak ve önbellek bilgisini ekler.
 */
export interface DataBasis extends ValuationBasis {
  mode: DataMode;
  sourceLinks: SourceLink[];
  groundedSourceCount: number;
  fromCache: boolean;
  platforms: PlatformStat[];
  searchStatus: SearchStatus;
  /** Arama başarısız olduysa nedeni; aksi halde boş */
  searchNote: string;
  parsedBy: ParseMode;
  /** Yapay zeka çıkarma yolunda, fiyatı arama metninde bulunamadığı için atılan ilan sayısı */
  rejectedUnverified: number;
}

/** Gerçek, bağlantılı bir ilan. Bağlantısı olmayan kayıt alternatif olarak gösterilmez. */
export interface AlternativeListing {
  title: string;
  price: number;
  source: string;
  url: string;
  /** Bağlantının sunucusu, arama sonuçlarında doğrulanan kaynaklar arasında mı */
  urlGrounded: boolean;
  savingsTL: number;
  savingsPct: number;
  /** 0-100; ilanda ya da arama sonucunda yoksa null. Uydurulmaz. */
  sellerTrust: number | null;
  /** İlanda belirtilmemişse null. Uydurulmaz. */
  delivery: DeliveryType | null;
  reason: string;
  searchQuery: string;
}

export interface EkspertizReport {
  category: string;
  deviceCategory: DeviceCategory;
  productName: string;
  listingPrice: number;
  marketPrice: PriceRange | null;
  /** true ise marketPrice gerçek ilanlardan değil, yapay zeka tahminidir ve doğrulanmamıştır */
  marketPriceIsEstimate: boolean;
  verdict: Verdict;
  decision: Decision;
  suspiciouslyLow: boolean;
  estimated: boolean;
  recommendation: string;
  confidence: number;
  priceDeviation: PriceDeviation;
  identity: EkspertizIdentity;
  summary: string;
  technicalComments: string;
  technicalItems: TechItem[];
  hardwareMetrics: HardwareMetric[];
  repairability: RepairabilityDetail | null;
  strengths: string[];
  riskAnalysis: string[];
  missingData: string[];
  checklist: string[];
  imageFindings: string[];
  warnings: string[];
  bargainingPlan: BargainingPlan;
  alternativesStatus: AlternativesStatus;
  /** Model ve depolama eşleşen, ilan fiyatından ucuz en düşük fiyatlı gerçek ilan */
  bestAlternative: AlternativeListing | null;
  betterAlternatives: AlternativeListing[];
  alternatives: string[];
  basis: DataBasis;
  disclaimer: string;
  generatedAt: string;
}

export interface EkspertizMeta {
  models: string[];
  usedFallback: boolean;
  elapsedMs: number;
}

export interface EkspertizApiResponse {
  success: boolean;
  report?: EkspertizReport;
  error?: string;
  meta?: EkspertizMeta;
}