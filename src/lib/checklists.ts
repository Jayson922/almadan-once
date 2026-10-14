export interface CheckItem {
  id: string;
  label: string;
  category: "legal" | "hardware" | "cosmetic";
  critical?: boolean;
}

// Türkiye pazarı ortak yasal & güvenlik kontrolleri
export const TURKEY_COMMON_CHECKLIST: CheckItem[] = [
  {
    id: "imei_check",
    label: "e-Devlet üzerinden IMEI sorgulaması yapın (Kapanma riski & Klon IMEI kontrolü).",
    category: "legal",
    critical: true,
  },
  {
    id: "fatura_box",
    label: "Kutu ve fatura seri numarası ile cihaz seri numarasını karşılaştırın.",
    category: "legal",
  },
  {
    id: "iclock_cloud",
    label: "Cihazın iCloud / Google hesabının tamamen çıkış yapıldığından emin olun.",
    category: "legal",
    critical: true,
  },
];

export const APPLE_CHECKLIST: CheckItem[] = [
  {
    id: "battery_health",
    label: "Pil Sağlığı %80 altındaysa batarya değişim maliyetini pazarlıkta düşürün.",
    category: "hardware",
  },
  {
    id: "face_truetone",
    label: "Ekran değişmiş mi? True Tone ve Face ID / Touch ID çalışıyor mu kontrol edin.",
    category: "hardware",
    critical: true,
  },
  {
    id: "parts_history",
    label: "Ayarlar > Genel > Hakkında kısmında 'Bilinmeyen Parça' uyarısı var mı?",
    category: "hardware",
    critical: true,
  },
];

export const ANDROID_CHECKLIST: CheckItem[] = [
  {
    id: "dial_test",
    label: "*#0*# veya *#*#64663#*#* kodu ile donanım test menüsünü çalıştırın.",
    category: "hardware",
  },
  {
    id: "burn_in",
    label: "Beyaz fonda amblem/tuş izi (AMOLED Burn-in ekran yanığı) kontrolü yapın.",
    category: "hardware",
    critical: true,
  },
];

export function getChecklistForModel(phoneName: string): CheckItem[] {
  const name = phoneName.toLowerCase();
  const isApple = name.includes("iphone") || name.includes("apple");

  const specificList = isApple ? APPLE_CHECKLIST : ANDROID_CHECKLIST;
  return [...TURKEY_COMMON_CHECKLIST, ...specificList];
}