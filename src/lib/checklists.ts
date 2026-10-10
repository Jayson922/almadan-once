export interface CheckItem {
  id: string;
  title: string;
  description: string;
  critical: boolean;
  impactPercent: number; // Fiyata etki yüzdesi (değer kaybı)
}

export const COMMON_CHECKLIST: CheckItem[] = [
  {
    id: "invoice_box",
    title: "Kutu ve Fatura Durumu",
    description: "Kutu, orijinal şarj kablosu ve Türkçe fatura/SBD mevcut mu?",
    critical: false,
    impactPercent: 5,
  },
  {
    id: "body_cosmetic",
    title: "Kasa ve Cam Kozmetiği",
    description: "Kasada vuruk, ezik veya camda derin çizik var mı?",
    critical: false,
    impactPercent: 8,
  },
  {
    id: "camera_lens",
    title: "Kamera Lensleri ve Odaklama",
    description: "Tüm kameralar (0.5x, 1x, Telefoto) tozsuz ve net odaklıyor mu?",
    critical: true,
    impactPercent: 15,
  },
];

export const APPLE_CHECKLIST: CheckItem[] = [
  {
    id: "face_id",
    title: "Face ID / Touch ID",
    description: "Biyometrik doğrulama sorunsuz çalışıyor mu?",
    critical: true,
    impactPercent: 20,
  },
  {
    id: "battery_health",
    title: "Pil Sağlığı (%80 Altı veya Değişmiş)",
    description: "Pil sağlığı %80 altında mı veya servis uyarısı var mı?",
    critical: false,
    impactPercent: 10,
  },
  {
    id: "true_tone",
    title: "True Tone ve Ekran Değişimi",
    description: "True Tone aktif mi? Ekran değiştiyse 'Bilinmeyen Parça' uyarısı var mı?",
    critical: true,
    impactPercent: 18,
  },
];

export const ANDROID_CHECKLIST: CheckItem[] = [
  {
    id: "amoled_burnin",
    title: "AMOLED Ekran Yanığı (Burn-in)",
    description: "Beyaz fonda ekranda gölge, klavye veya amblem izi kalmış mı?",
    critical: true,
    impactPercent: 15,
  },
  {
    id: "knox_bootloader",
    title: "Knox / Bootloader Kilidi",
    description: "Samsung Knox sayacı sıfırlanmış mı veya Xiaomi ROM atılmış mı?",
    critical: true,
    impactPercent: 25,
  },
];

export function getChecklistForModel(phoneName: string): CheckItem[] {
  const isApple = phoneName.toLowerCase().includes("iphone") || phoneName.toLowerCase().includes("apple");
  return isApple ? [...APPLE_CHECKLIST, ...COMMON_CHECKLIST] : [...ANDROID_CHECKLIST, ...COMMON_CHECKLIST];
}