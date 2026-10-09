export interface PhonePriceEntry {
  id: string;
  name: string;
  storage: string;
  /** TL cinsinden ikinci el piyasa aralığı. Veri yoksa null. */
  min: number | null;
  max: number | null;
}

/** Tablonun son güncelleme tarihi. */
export const PRICE_TABLE_UPDATED_AT: string | null = "2026-10-09";

/**
 * NOT: Aralıklar kesin piyasa verisi değil, başlangıç tahminidir.
 * Kaynak: yenilenmiş cihaz mağaza fiyatları (Ekim 2026), bireysel
 * satıcı ilanları için alt sınır tahminen düşürüldü.
 * Veri olmayan modeller null bırakıldı, sistem BELİRSİZ der.
 */
export const PHONE_PRICE_TABLE: PhonePriceEntry[] = [
  { id: "iphone-13-128", name: "Apple iPhone 13", storage: "128 GB", min: 20000, max: 30000 },
  { id: "iphone-14-128", name: "Apple iPhone 14", storage: "128 GB", min: 26000, max: 35000 },
  { id: "iphone-15-128", name: "Apple iPhone 15", storage: "128 GB", min: null, max: null },
  { id: "galaxy-s23-256", name: "Samsung Galaxy S23", storage: "256 GB", min: null, max: null },
  { id: "galaxy-s24-256", name: "Samsung Galaxy S24", storage: "256 GB", min: null, max: null },
];