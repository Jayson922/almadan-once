export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
}

export const PHONE_RISK_CHECKLIST: ChecklistItem[] = [
  {
    id: "imei",
    title: "IMEI kayıt durumunu kontrol et",
    detail:
      "Telefonun IMEI numarasını (arama ekranında *#06# yazınca görünür) e-Devlet üzerinden sorgula. Kayıtsız ya da engelli bir telefon Türkiye'de kullanılamayabilir.",
  },
  {
    id: "account-lock",
    title: "Hesap kilidi kapalı mı?",
    detail:
      "iPhone'da Apple Kimliği ve Bul özelliği kapalı, Android'de Google hesabı çıkarılmış olmalı. Satıcı hesabından çıkış yapıp telefonu senin yanında sıfırlasın.",
  },
  {
    id: "battery",
    title: "Pil sağlığına bak",
    detail:
      "iPhone'da Ayarlar > Pil > Pil Sağlığı bölümünde görülür. Android'de menü markaya göre değişir. Düşük pil sağlığı yakında pil değişimi demek.",
  },
  {
    id: "repairs",
    title: "Ekran ve parça değişimi var mı?",
    detail:
      "Ekranda renk farkı, leke ya da kasada açılma izi var mı bak. Satıcıya daha önce tamir görüp görmediğini sor.",
  },
  {
    id: "warranty",
    title: "Fatura, kutu ve garanti",
    detail:
      "Fatura ve garanti süresi hem değer hem güven açısından önemli. Faturadaki seri numarası telefonla eşleşmeli.",
  },
  {
    id: "function-test",
    title: "Parayı vermeden önce her şeyi dene",
    detail:
      "Kamera, hoparlör, mikrofon, şarj, Wi-Fi, SIM, dokunmatik ekran ve biyometrik kilit (Face ID ya da parmak izi) çalışıyor mu kontrol et.",
  },
  {
    id: "price-too-low",
    title: "Fiyat piyasanın çok altında mı?",
    detail:
      "Aynı model ve durumdaki telefonlara göre çok ucuz bir fiyat çoğu zaman sahtekârlık ya da gizli bir sorun işaretidir.",
  },
  {
    id: "payment-pressure",
    title: "Ön ödeme ya da acele baskısı",
    detail:
      "Kapora isteyen, sadece kargoyla satan, buluşmayı reddeden ya da acele ettiren satıcılara karşı dikkatli ol. Ödemeyi telefonu eline alıp kontrol ettikten sonra yap.",
  },
  {
    id: "safe-meeting",
    title: "Güvenli yerde buluş",
    detail:
      "Kalabalık, aydınlık bir yerde, mümkünse gündüz buluş. Yanında birini götürmen iyi olur.",
  },
];

export const PHONE_SELLER_QUESTIONS: string[] = [
  "Telefonu ne zamandan beri kullanıyorsun, neden satıyorsun?",
  "Hiç tamir gördü mü, ekranı ya da pili değişti mi?",
  "Pil sağlığı yüzde kaç?",
  "Faturası, kutusu ve garantisi var mı?",
  "IMEI numarasını paylaşır mısın? Kayıt durumunu kontrol etmek istiyorum.",
  "Hesaplarından çıkış yapıp telefonu görüşmede sıfırlayabilir misin?",
  "Fiyatta pazarlık payı var mı?",
];