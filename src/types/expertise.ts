export type RiskLevel = 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';

export type PartAvailability = 'Kolay' | 'Orta' | 'Zor';

export interface ChronicIssue {
  issue: string;
  riskLevel: RiskLevel;
  description: string;
  estimatedRemainingLifespanYears?: number;
}

export interface RepairCostRange {
  min: number;
  max: number;
  currency: 'TL' | 'USD' | 'EUR';
}

export interface RepairabilityInfo {
  /** 1 (çok zor) - 10 (çok kolay) */
  repairabilityScore: number;
  commonReplacedParts: string[];
  aftermarketPartAvailability: PartAvailability;
  estimatedRepairCostRange: RepairCostRange;
}

export interface CategoryExpertise {
  chronicRisks: ChronicIssue[];
  repairability: RepairabilityInfo;
  estimatedRemainingLifespanYears: number;
}