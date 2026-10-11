import { ChronicIssue, RepairabilityInfo } from '@/types/expertise';

export interface AdvancedExpertiseAnalysis {
  chronicRisks: ChronicIssue[];
  repairability: RepairabilityInfo;
  estimatedRemainingLifespanYears: number;
}

/**
  * Profesyonel Kronik Sorunlar, Tamir Edilebilirlik ve Ömür Analiz Motoru
  */
export function getAdvancedExpertiseEngine(
  brand: string, 
  model: string, 
  category: string
): AdvancedExpertiseAnalysis {
  const b = brand.toLowerCase().trim();

  // --- 1. AKILLI TELEFON KATEGORİSİ ---
  if (category === 'smartphone') {
    if (b.includes('apple') || b.includes('iphone')) {
      return {
        chronicRisks: [
          {
            issue: 'Batarya Kapasite Degradasyonu',
            riskLevel: 'Orta',
            description: 'Lityum-iyon piller ortalama 500 şarj döngüsü sonrasında %80 altına düşer; ani kapanmalar yaşanabilir.',
            estimatedRemainingLifespanYears: 3
          },
          {
            issue: 'Face ID / TrueDepth Kamera Hassasiyeti',
            riskLevel: 'Düşük',
            description: 'Orijinal olmayan ekran değişimlerinde Face ID devre dışı kalabilir.',
            estimatedRemainingLifespanYears: 4
          }
        ],
        repairability: {
          repairabilityScore: 6,
          commonReplacedParts: ['Batarya', 'Ekran', 'Arka Cam'],
          aftermarketPartAvailability: 'Kolay',
          estimatedRepairCostRange: { min: 1000, max: 5000, currency: 'TL' }
        },
        estimatedRemainingLifespanYears: 3.5
      };
    } 
    
    if (b.includes('samsung') || b.includes('xiaomi')) {
      return {
        chronicRisks: [
          {
            issue: 'OLED / AMOLED Ekran Hayalet Ekran (Burn-in)',
            riskLevel: 'Orta',
            description: 'Uzun süre sabit parlak ekranda kalmaya bağlı menü izlerinin silikleşmesi.',
            estimatedRemainingLifespanYears: 2.5
          }
        ],
        repairability: {
          repairabilityScore: 5,
          commonReplacedParts: ['Batarya', 'OLED Panel', 'Şarj Bordü'],
          aftermarketPartAvailability: 'Kolay',
          estimatedRepairCostRange: { min: 800, max: 4500, currency: 'TL' }
        },
        estimatedRemainingLifespanYears: 3
      };
    }
  }

  // --- 2. DİZÜSTÜ BİLGİSAYAR (LAPTOP) KATEGORİSİ ---
  if (category === 'laptop') {
    return {
      chronicRisks: [
        {
          issue: 'Menteşe ve Kasa Çatlaması / Gevşemesi',
          riskLevel: 'Yüksek',
          description: 'Plastik kasalı modellerde ekranı tek taraftan açma kapama alışkanlığı menteşe yuvalarını zorlar.',
          estimatedRemainingLifespanYears: 2.5
        },
        {
          issue: 'Termal Macun Kuruması ve Isınma',
          riskLevel: 'Yüksek',
          description: 'Bakım yapılmadığında fan sesinde artış ve performans düşüşü kaçınılmazdır.',
          estimatedRemainingLifespanYears: 3
        }
      ],
      repairability: {
        repairabilityScore: 7,
        commonReplacedParts: ['NVMe SSD', 'RAM', 'Batarya', 'Termal Macun'],
        aftermarketPartAvailability: 'Kolay',
        estimatedRepairCostRange: { min: 1500, max: 6000, currency: 'TL' }
      },
      estimatedRemainingLifespanYears: 4
    };
  }

  // --- 3. GENEL / VARSAYILAN MOTOR ---
  return {
    chronicRisks: [
      {
        issue: 'Standart Yaşlanma ve Parça Yorgunluğu',
        riskLevel: 'Düşük',
        description: 'Ürünün piyasaya çıkış yılına ve kullanım yoğunluğuna bağlı doğal eskime.',
        estimatedRemainingLifespanYears: 3
      }
    ],
    repairability: {
      repairabilityScore: 5,
      commonReplacedParts: ['Sarf malzemeleri'],
      aftermarketPartAvailability: 'Orta',
      estimatedRepairCostRange: { min: 500, max: 3000, currency: 'TL' }
    },
    estimatedRemainingLifespanYears: 3
  };
}