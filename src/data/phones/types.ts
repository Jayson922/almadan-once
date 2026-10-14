// src/data/phones/types.ts
// Telefon veri katmanının ortak tip tanımı.
// Kural: doğrulanamayan alan null kalır, tahminle doldurulmaz.
// Her kayıtta kaynak listesi ve son kontrol tarihi bulunur.

export type PhoneBrand = "Apple" | "Samsung" | "Xiaomi / Poco" | "Google" | "Diğer";

export type LensRole = "ana" | "ultra geniş" | "telefoto" | "makro" | "derinlik";

export interface CameraLens {
  role: LensRole;
  mp: number;
  /** Örn: "f/1.8" */
  aperture: string | null;
  /** Telefoto için optik yakınlaştırma katı, örn: 5 */
  opticalZoom: number | null;
  /** Optik görüntü sabitleme var mı */
  ois: boolean | null;
}

export interface PhoneDisplay {
  sizeInch: number | null;
  /** Örn: "OLED", "Dynamic AMOLED 2X", "LCD" */
  panel: string | null;
  refreshHz: number | null;
  resolution: string | null;
}

/** Modele özel, bilinen bir sorun ve alıcının bakması gereken kontrol. */
export interface KnownIssue {
  title: string;
  detail: string;
  /** Alıcının yüz yüze görüşmede yapacağı somut kontrol */
  check: string;
  /** Bu bilginin dayandığı kaynak */
  sourceUrl: string;
}

export interface PhoneSource {
  label: string;
  url: string;
}

export interface PhoneSpec {
  /** Benzersiz anahtar, örn: "apple-iphone-15-pro" */
  id: string;
  brand: PhoneBrand;
  /** Arayüzde yazan ad, örn: "iPhone 15 Pro" */
  model: string;
  /** Kullanıcının yazabileceği diğer adlar */
  aliases: string[];
  releaseYear: number | null;

  /** Resmi olarak yayımlanan RAM seçenekleri (GB) */
  ramGb: number[];
  /** RAM üretici tarafından açıklanmadıysa "third-party" (resmi değil) */
  ramSource: "official" | "third-party";
  storageGb: number[];
  colors: string[];

  chipset: string | null;
  display: PhoneDisplay;
  rearCameras: CameraLens[];
  frontCameraMp: number | null;

  batteryMah: number | null;
  /** Kablolu şarj gücü (W) */
  chargingW: number | null;
  /** Örn: "IP68" */
  ipRating: string | null;
  /** Fiziksel SIM ve eSIM bilgisi, örn: "Nano-SIM + eSIM" */
  sim: string | null;

  knownIssues: KnownIssue[];

  sources: PhoneSource[];
  /** Son kontrol tarihi, ISO biçiminde: "2026-10-14" */
  verifiedAt: string;
}