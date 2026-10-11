// 1. Ürün Kategorileri
export type ProductCategory = 'smartphone' | 'laptop' | 'appliance' | 'automotive' | 'general';

// 2. Genel Teknik Özellikler (Ortak Taban)
export interface BaseTechnicalSpecs {
  brand: string;
  model: string;
  variant?: string;
  releaseYear?: number;
  conditionScore: number; // 1-10 arası genel durum puanı
}

// 3. Kategoriye Özel Teknik Parametreler
export interface SmartphoneSpecifics {
  screenSize: string;
  batteryHealth?: number; // Yüzde olarak (örn: %88)
  storage: string;
  ram: string;
  isUnlocked: boolean;
  screenReplaced?: boolean;
}

export interface LaptopSpecifics {
  processor: string;
  ram: string;
  storage: string;
  gpu: string;
  batteryCycleCount?: number;
  screenResolution?: string;
}

export interface AutomotiveSpecifics {
  mileage: number; // Kilometre
  transmission: 'Manuel' | 'Otomatik' | 'Yarı Otomatik';
  fuelType: 'Benzin' | 'Dizel' | 'Hibrit' | 'Elektrik';
  chassisStatus: string; // Boya / Değişen durumu
  engineCapacity?: string;
}

export interface ApplianceSpecifics {
  energyClass: string; // Örn: A+++
  capacity: string; // Örn: 9 kg, 500 lt
  warrantyStatus: string;
}

// Kategoriye göre tip güvenli (Union) eşleme
export type CategorySpecificSpecs = 
  | ({ category: 'smartphone' } & SmartphoneSpecifics)
  | ({ category: 'laptop' } & LaptopSpecifics)
  | ({ category: 'automotive' } & AutomotiveSpecifics)
  | ({ category: 'appliance' } & ApplianceSpecifics)
  | ({ category: 'general' } & Record<string, any>);

// 4. Donanım Güçlü ve Zayıf Yönleri
export interface ProsAndCons {
  strengths: string[];
  weaknesses: string[];
}

// 5. Kronik Sorunlar ve Kullanım Ömrü
export interface ChronicIssue {
  issue: string;
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
  description: string;
  estimatedRemainingLifespanYears: number;
}

// 6. Tamir Edilebilirlik ve Parça Durumu
export interface RepairabilityInfo {
  repairabilityScore: number; // 1-10 arası (10 en kolay tamir edilen)
  commonReplacedParts: string[];
  aftermarketPartAvailability: 'Kolay' | 'Orta' | 'Zor';
  estimatedRepairCostRange?: { min: number; max: number; currency: string };
}

// 7. Görsel Kusurlar vs. Doğrulanamayan Özellikler (Kritik Ayrım)
export interface VerificationBreakdown {
  visibleFlaws: {
    flaw: string; // Örn: "Ekran sağ üst köşede kılcal çatlak", "Kasa arkasında derin çizik"
    severity: 'Kozmetik' | 'Orta' | 'Kritik';
    location: string;
  }[];
  unverifiedClaims: {
    claim: string; // Örn: "Batarya orijinaliyle değişti", "Hatasız / Boyasız"
    riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
    verificationAdvice: string; // Kullanıcıya elden kontrol tavsiyesi
  }[];
}

// 8. Ana Teknik Ekspertiz Rapor Şeması (Tüm Sistemi Birleştiren Nokta)
export interface TechnicalExpertiseReport {
  productId: string;
  category: ProductCategory;
  specs: BaseTechnicalSpecs & CategorySpecificSpecs;
  analysis: ProsAndCons;
  chronicRisks: ChronicIssue[];
  repairability: RepairabilityInfo;
  verification: VerificationBreakdown;
  generatedAt: string;
}