import type { RiskLevel } from './expertise';

export type ExpertiseCategory =
  | 'smartphone'
  | 'laptop'
  | 'automotive'
  | 'appliance'
  | 'general';

export interface PiyasaAraligi {
  min: number;
  max: number;
}

export interface ListingInputPayload {
  modelName?: string;
  price?: number;
  notes?: string;
  features?: string[];
  /** Dışarıdan (fiyat tablosu / canlı veri) gelen piyasa aralığı. Yoksa skor üretilmez. */
  marketPrice?: PiyasaAraligi | null;
}

export interface KronikSorun {
  sorun: string;
  riskSeviyesi: RiskLevel;
  açıklama: string;
}

export interface GorselKusur {
  kusur: string;
  ciddiyet: 'Kozmetik' | 'Orta' | 'Ciddi';
}

export interface DogrulanamayanIddia {
  iddia: string;
  eldenKontrolTavsiyesi: string;
}

export interface TeknikDeğerlendirme {
  markaModelVaryant: string;
  güçlüYönler: string[];
  zayıfYönler: string[];
  kronikSorunlar: KronikSorun[];
  tahminiKalanÖmürYıl: number;
  tamirEdilebilirlikPuanı: number;
  görselKusurlar: GorselKusur[];
  doğrulanamayanİddialar: DogrulanamayanIddia[];
  kozmetikDurum: string;
  donanımDurum: string;
  fiyatMantigi: string;
}

export interface YonlendirmeTavsiyesi {
  platform: string;
  url: string;
  aciklama: string;
}

export interface ExpertiseReport {
  /** 0-100; piyasa verisi yoksa null */
  arbitrajSkoru: number | null;
  tavsiye: string;
  tahminiPiyasaMin: number | null;
  tahminiPiyasaMax: number | null;
  yonlendirmeTavsiyeleri: YonlendirmeTavsiyesi[];
  teknikDeğerlendirme: TeknikDeğerlendirme;
  riskRaporu: string[];
}