import type { ChronicIssue, RepairabilityInfo } from "@/types/expertise";
import type { ExpertiseCategory } from "@/types/report";

/**
 * Uzmanlık profilleri (veri tablosu).
 * Bunlar GENEL eğilimlerdir; belirli bir cihazın durumunu değil, kategori/marka/model için
 * bilinen sık sorunları gösterir. TL maliyetleri hızlı eskir: yalnızca kaba büyüklük içindir.
 */

export interface DataIssue extends ChronicIssue {
  id: string;
  /** Cihaz yaşı bu değere ulaştıysa risk bir kademe artar. */
  ageEscalationYears?: number;
  /** Pil sağlığı verilirse (%80 altı) risk artar. */
  batteryLinked?: boolean;
}

export interface Profile {
  id: string;
  label: string;
  category: ExpertiseCategory;
  /** Küçük harf ve aksansız birleştirilmiş "marka model" metnine karşı test edilir. */
  match: RegExp;
  /** 1 = kategori varsayılanı, 2 = marka, 3 = model/özel durum */
  specificity: 1 | 2 | 3;
  issues: DataIssue[];
  repair?: RepairabilityInfo;
  baseLifespanYears?: number;
  checks: string[];
}

export const PROFILES: Profile[] = [
  // ───────────────────────── AKILLI TELEFON ─────────────────────────
  {
    id: "smartphone-default",
    label: "Akıllı telefon (genel)",
    category: "smartphone",
    match: /./,
    specificity: 1,
    baseLifespanYears: 5,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Ekran", "Batarya", "Şarj yuvası", "Arka cam"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 1500, max: 10000, currency: "TL" },
    },
    issues: [
      {
        id: "battery-wear",
        issue: "Batarya aşınması",
        riskLevel: "Orta",
        description:
          "Lityum-iyon piller şarj döngüsüyle kapasite kaybeder; yıpranmış pil kısa pil ömrüne ve ani kapanmalara yol açabilir.",
        estimatedRemainingLifespanYears: 2,
        ageEscalationYears: 3,
        batteryLinked: true,
      },
      {
        id: "screen-damage",
        issue: "Ekran / cam hasarı",
        riskLevel: "Orta",
        description:
          "Çatlak, dokunmatik kayması, ölü piksel ya da renk bozukluğu olabilir; ekran değişimi pahalı olabilir.",
      },
      {
        id: "liquid-damage",
        issue: "Sıvı teması izleri",
        riskLevel: "Orta",
        description:
          "Sıvı teması sonradan ortaya çıkan korozyon ve arızalara yol açabilir; kamera, hoparlör, mikrofon ve şarj yuvasını dikkatle deneyin.",
      },
      {
        id: "imei-registry",
        issue: "IMEI kaydı ve operatör kilidi",
        riskLevel: "Orta",
        description:
          "Kayıtsız ya da operatöre kilitli cihaz hatta kullanılamayabilir; IMEI numarasını e-Devlet üzerinden sorgulayın.",
      },
      {
        id: "charge-port",
        issue: "Şarj yuvası aşınması",
        riskLevel: "Düşük",
        description: "Gevşek kablo oturması ya da kesik kesik şarj, yuvanın yıprandığını gösterebilir.",
      },
    ],
    checks: [
      "IMEI numarasını (*#06#) alıp e-Devlet üzerinden sorgulayın",
      "Tüm kameraları, hoparlörü, mikrofonu, şarj yuvasını ve tuşları deneyin",
      "Ekranda ölü piksel, yanma izi ve dokunmatik kaymasını kontrol edin",
      "Pil sağlığını ayarlardan kontrol edin (varsa)",
      "Orijinal kutu, fatura ve garanti belgesini isteyin",
    ],
  },
  {
    id: "apple-phone",
    label: "Apple iPhone",
    category: "smartphone",
    match: /\b(iphone|apple)\b/,
    specificity: 2,
    baseLifespanYears: 6,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Ekran", "Batarya", "Arka cam", "Kamera"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 3000, max: 18000, currency: "TL" },
    },
    issues: [
      {
        id: "battery-wear",
        issue: "Batarya kapasite kaybı",
        riskLevel: "Orta",
        description:
          "Pil sağlığı Ayarlar > Pil bölümünde görülebilir; yaklaşık %80 altı belirgin pil ömrü kaybı anlamına gelir.",
        estimatedRemainingLifespanYears: 2,
        ageEscalationYears: 3,
        batteryLinked: true,
      },
      {
        id: "activation-lock",
        issue: "iCloud kilidi (Bul)",
        riskLevel: "Yüksek",
        description:
          "Önceki sahibin Apple hesabı cihazdan çıkarılmamışsa cihaz kilitli kalır; teslimde Ayarlar'dan hesabın çıkarıldığını ve cihazın sıfırlanabildiğini doğrulayın.",
      },
      {
        id: "non-genuine-parts",
        issue: "Orijinal olmayan parça / Face ID",
        riskLevel: "Orta",
        description:
          "Ekran, batarya ve Face ID modülü değişimleri sorun çıkarabilir; yeni iOS sürümlerinde Ayarlar > Genel > Hakkında bölümünde parça ve servis geçmişi görülebilir (varsa).",
      },
    ],
    checks: [
      "Ayarlar > Apple Kimliği bölümünde hesabın çıkarıldığını doğrulayın (iCloud kilidi)",
      "Pil sağlığı yüzdesine bakın",
      "Ayarlar > Genel > Hakkında içinde parça geçmişi uyarısı var mı kontrol edin",
      "Face ID ve True Tone çalışıyor mu deneyin",
    ],
  },
  {
    id: "apple-phone-older",
    label: "Eski iPhone modelleri",
    category: "smartphone",
    match: /\biphone ?(6s?|7|8|x|xr|xs|11|se)\b/,
    specificity: 3,
    baseLifespanYears: 3,
    issues: [
      {
        id: "software-support",
        issue: "Yazılım güncelleme desteği",
        riskLevel: "Orta",
        description:
          "Eski modellerde güncel iOS desteği sona ermiş ya da sona ermek üzere olabilir; bazı uygulamalar yeni sürüm ister. Güncel destek listesini Apple'dan doğrulayın.",
      },
    ],
    checks: ["Cihazın yüklenebilen en yeni iOS sürümünü ve gerekli uygulamalarla uyumunu kontrol edin"],
  },
  {
    id: "samsung-phone",
    label: "Samsung Galaxy",
    category: "smartphone",
    match: /\b(samsung|galaxy)\b/,
    specificity: 2,
    baseLifespanYears: 5,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Ekran (AMOLED)", "Batarya", "Şarj yuvası"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 2500, max: 15000, currency: "TL" },
    },
    issues: [
      {
        id: "green-line",
        issue: "AMOLED ekranda renkli çizgi",
        riskLevel: "Orta",
        description:
          "Bazı Galaxy modellerinde ekranda dikey yeşil/pembe çizgi şikayetleri bildirilmiştir; ekranı beyaz ve siyah zeminle uzun süre açık tutarak deneyin.",
      },
      {
        id: "burn-in",
        issue: "Ekran izi (burn-in)",
        riskLevel: "Orta",
        description: "Uzun süre sabit görüntüde kalan OLED panellerde silik hayalet izler oluşabilir.",
      },
    ],
    checks: ["Ekranı tam beyaz, siyah ve gri zeminde açıp çizgi ve gölge arayın"],
  },
  {
    id: "samsung-exynos-s2x",
    label: "Galaxy S21/S22 (Exynos sürümleri)",
    category: "smartphone",
    match: /\bs2[12]\b/,
    specificity: 3,
    issues: [
      {
        id: "thermal-throttling",
        issue: "Isınma ve performans kısıtlaması",
        riskLevel: "Orta",
        description:
          "Exynos işlemcili sürümlerde yoğun kullanımda ısınma ve performans düşürme bildirilmiştir; sattığınız sürümün işlemcisini doğrulayın.",
      },
    ],
    checks: ["Oyun ya da kamera ile birkaç dakika yük bindirip ısınmayı gözlemleyin"],
  },
  {
    id: "samsung-foldable",
    label: "Samsung katlanır (Fold/Flip)",
    category: "smartphone",
    match: /\b(z ?(fold|flip)|fold|flip)\b/,
    specificity: 3,
    baseLifespanYears: 4,
    repair: {
      repairabilityScore: 3,
      commonReplacedParts: ["İç ekran", "Menteşe", "Dış ekran"],
      aftermarketPartAvailability: "Zor",
      estimatedRepairCostRange: { min: 5000, max: 35000, currency: "TL" },
    },
    issues: [
      {
        id: "foldable-hinge",
        issue: "Katlanır ekran ve menteşe",
        riskLevel: "Yüksek",
        description:
          "Katlanır iç ekran ve menteşe hassastır; katman kalkması, belirgin kırışıklık ya da menteşe sesi arızaya işaret edebilir.",
      },
    ],
    checks: ["İç ekranı açıp kapatarak katman kalkması, ses ve belirgin kırışıklık arayın"],
  },
  {
    id: "xiaomi-phone",
    label: "Xiaomi / Redmi / Poco",
    category: "smartphone",
    match: /\b(xiaomi|redmi|poco)\b/,
    specificity: 2,
    baseLifespanYears: 4,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Ekran", "Batarya", "Şarj yuvası"],
      aftermarketPartAvailability: "Kolay",
      estimatedRepairCostRange: { min: 1000, max: 6000, currency: "TL" },
    },
    issues: [
      {
        id: "mi-account",
        issue: "Mi Hesabı / cihaz kilidi",
        riskLevel: "Yüksek",
        description:
          "Önceki sahibin Mi Hesabı cihazdan çıkarılmamışsa cihaz kilitli kalabilir; hesabın çıkarıldığını elden doğrulayın.",
      },
      {
        id: "update-support",
        issue: "Güncelleme desteği süresi",
        riskLevel: "Orta",
        description:
          "Yazılım güncelleme süresi modele göre değişir (özellikle giriş segmentinde kısadır); resmi destek süresini kontrol edin.",
      },
      {
        id: "region-version",
        issue: "Bölgesel yazılım sürümü",
        riskLevel: "Düşük",
        description:
          "Küresel olmayan sürümlerde dil ve Google hizmetleri farklı olabilir; model numarasını doğrulayın.",
      },
    ],
    checks: ["Ayarlar'dan Mi Hesabı ve Cihazımı Bul durumunu kontrol edin"],
  },
  {
    id: "huawei-phone",
    label: "Huawei",
    category: "smartphone",
    match: /\bhuawei\b/,
    specificity: 2,
    baseLifespanYears: 4,
    issues: [
      {
        id: "no-gms",
        issue: "Google hizmetleri sınırlaması",
        riskLevel: "Yüksek",
        description:
          "2019 sonrası çıkan Huawei modellerinin çoğunda Google Mobil Hizmetleri (Play Store, Gmail vb.) yoktur; ihtiyaçlarınıza uyup uymadığını düşünün.",
      },
    ],
    checks: ["Kullandığınız uygulamaların cihazda çalıştığını önceden doğrulayın"],
  },

  // ───────────────────────── DİZÜSTÜ BİLGİSAYAR ─────────────────────────
  {
    id: "laptop-default",
    label: "Dizüstü bilgisayar (genel)",
    category: "laptop",
    match: /./,
    specificity: 1,
    baseLifespanYears: 6,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Batarya", "SSD", "RAM", "Klavye", "Ekran"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 1500, max: 12000, currency: "TL" },
    },
    issues: [
      {
        id: "battery-wear",
        issue: "Batarya aşınması",
        riskLevel: "Orta",
        description: "Pil döngü sayısı arttıkça süre kısalır; çok yıpranmış pil şişebilir ve değişim gerektirir.",
        ageEscalationYears: 3,
        batteryLinked: true,
      },
      {
        id: "thermal",
        issue: "Termal macun ve fan yıpranması",
        riskLevel: "Orta",
        description:
          "Yaşla birlikte soğutma performansı düşer; ısınma, fan gürültüsü ve performans kaybı görülebilir.",
        ageEscalationYears: 3,
      },
      {
        id: "storage-health",
        issue: "Disk (SSD/HDD) sağlığı",
        riskLevel: "Orta",
        description: "Disk sağlığı bilinmiyorsa ani arıza ve veri kaybı riski vardır; SMART değerlerine bakın.",
      },
      {
        id: "hinge",
        issue: "Menteşe ve gövde çatlağı",
        riskLevel: "Orta",
        description: "Menteşe çevresinde çatlak ya da gevşeklik, ekran kasasında zamanla büyüyen hasara yol açar.",
      },
      {
        id: "screen",
        issue: "Ekran ve arka ışık sorunları",
        riskLevel: "Düşük",
        description: "Işık sızması, titreme ya da ölü piksel olabilir.",
      },
    ],
    checks: [
      "Pil raporunu alın (Windows: powercfg /batteryreport)",
      "Disk sağlığını SMART aracıyla kontrol edin",
      "Tüm tuşları, USB/HDMI portlarını, kamerayı ve hoparlörü deneyin",
      "Birkaç dakika yük bindirip ısınmayı ve fan sesini gözlemleyin",
      "Şarj aletinin orijinal ve eksiksiz olduğunu kontrol edin",
    ],
  },
  {
    id: "macbook",
    label: "Apple MacBook",
    category: "laptop",
    match: /\bmacbook\b/,
    specificity: 2,
    baseLifespanYears: 7,
    repair: {
      repairabilityScore: 3,
      commonReplacedParts: ["Batarya", "Klavye (üst kasa)", "Ekran"],
      aftermarketPartAvailability: "Zor",
      estimatedRepairCostRange: { min: 4000, max: 35000, currency: "TL" },
    },
    issues: [
      {
        id: "mac-lock",
        issue: "iCloud kilidi / kurumsal yönetim (MDM)",
        riskLevel: "Yüksek",
        description:
          "Önceki sahip hesabını çıkarmamışsa ya da cihaz kurumsal yönetim altındaysa kullanım kısıtlanır; teslimde Mac'i silip yeniden kurarak doğrulayın.",
      },
      {
        id: "soldered",
        issue: "Lehimli RAM ve depolama",
        riskLevel: "Orta",
        description:
          "Yeni Mac modellerinde RAM ve depolama kart üzerine lehimlidir; sonradan yükseltilemez, ihtiyacınıza uygun kapasiteyi baştan seçmek gerekir.",
      },
    ],
    checks: [
      "Pil döngü sayısına Sistem Bilgisi > Güç bölümünden bakın",
      "Cihazı silip yeniden kurma ekranına kadar ilerleyerek kilitsiz olduğunu doğrulayın",
    ],
  },
  {
    id: "macbook-butterfly",
    label: "MacBook (2016-2019, kelebek klavye)",
    category: "laptop",
    match: /\bmacbook\b.*\b201[6-9]\b/,
    specificity: 3,
    issues: [
      {
        id: "butterfly-keyboard",
        issue: "Kelebek mekanizmalı klavye",
        riskLevel: "Yüksek",
        description:
          "2016-2019 arası MacBook modellerinde kelebek klavyede tuş tutukluğu ve çift basma şikayetleri bildirilmiştir; tüm tuşları tek tek deneyin.",
      },
    ],
    checks: ["Klavyede her tuşu tek tek deneyin, çift basma ve takılma arayın"],
  },
  {
    id: "macbook-pro-2016",
    label: "MacBook Pro 2016",
    category: "laptop",
    match: /\bmacbook pro\b.*\b2016\b/,
    specificity: 3,
    issues: [
      {
        id: "flexgate",
        issue: "Ekran arka ışık bozulması",
        riskLevel: "Orta",
        description:
          "2016 model MacBook Pro'larda ekranın alt kısmında gölgelenme ve arka ışık sorunu bildirilmiştir; ekranı farklı açılarda açıp kapatarak deneyin.",
      },
    ],
    checks: ["Ekran açısını değiştirirken alt kenarda gölgelenme ya da titreme arayın"],
  },
  {
    id: "thinkpad",
    label: "Lenovo ThinkPad",
    category: "laptop",
    match: /\bthinkpad\b/,
    specificity: 2,
    baseLifespanYears: 7,
    repair: {
      repairabilityScore: 7,
      commonReplacedParts: ["Batarya", "Klavye", "SSD", "RAM"],
      aftermarketPartAvailability: "Kolay",
      estimatedRepairCostRange: { min: 1000, max: 8000, currency: "TL" },
    },
    issues: [
      {
        id: "corporate-lock",
        issue: "Kurumsal kilit (BIOS / uzaktan yönetim)",
        riskLevel: "Orta",
        description:
          "İkinci el kurumsal cihazlarda BIOS yönetici parolası ya da uzaktan yönetim kaydı olabilir; BIOS'a girip parola istemediğini doğrulayın.",
      },
    ],
    checks: ["BIOS ekranına girip parola istenip istenmediğini kontrol edin"],
  },
  {
    id: "gaming-laptop",
    label: "Oyun dizüstüsü",
    category: "laptop",
    match: /\b(rog|legion|nitro|tuf|predator|omen|gaming|oyun)\b/,
    specificity: 3,
    issues: [
      {
        id: "heavy-heat",
        issue: "Yüksek ısı yükü (CPU/GPU)",
        riskLevel: "Yüksek",
        description:
          "Oyun dizüstülerinde yoğun ısı yükü termal macun ve fan ömrünü kısaltır; uzun süre yoğun kullanılmış cihazlarda ısınma ve performans kaybı olabilir.",
        ageEscalationYears: 2,
      },
    ],
    checks: ["Bir oyun ya da stres testiyle sıcaklığı ve performans düşüşünü gözlemleyin"],
  },

  // ───────────────────────── OTOMOBİL ─────────────────────────
  {
    id: "automotive-default",
    label: "Otomobil (genel)",
    category: "automotive",
    match: /./,
    specificity: 1,
    baseLifespanYears: 15,
    repair: {
      repairabilityScore: 6,
      commonReplacedParts: ["Fren", "Süspansiyon", "Akü", "Debriyaj"],
      aftermarketPartAvailability: "Kolay",
      estimatedRepairCostRange: { min: 3000, max: 80000, currency: "TL" },
    },
    issues: [
      {
        id: "odometer",
        issue: "Kilometre tutarlılığı",
        riskLevel: "Yüksek",
        description:
          "Kilometre düşürme ikinci el araçlarda bilinen bir risktir; bakım kayıtlarını ve servis geçmişini araçtaki aşınmayla karşılaştırın.",
      },
      {
        id: "damage-history",
        issue: "Hasar ve değişen parça geçmişi",
        riskLevel: "Yüksek",
        description:
          "Ağır hasar, boya/değişen ve airbag geçmişi değeri ve güvenliği etkiler; sigorta hasar kaydını sorgulayın ve bağımsız ekspertiz yaptırın.",
      },
      {
        id: "maintenance",
        issue: "Bakım geçmişi eksikliği",
        riskLevel: "Orta",
        description: "Düzenli bakım yapılmamış motor ve şanzıman erken aşınır; servis kayıtlarını isteyin.",
      },
      {
        id: "rust-underbody",
        issue: "Korozyon ve alt takım",
        riskLevel: "Orta",
        description: "Şasi, eşik ve alt takımda pas ya da yağ kaçağı olup olmadığına bakın.",
      },
    ],
    checks: [
      "Yetkili servis bakım kayıtlarını isteyin",
      "Resmi hasar sorgusu yapın ve bağımsız ekspertiz raporu aldırın",
      "Tavan, çamurluk ve kapı birleşimlerinde boya/kaynak izi arayın",
      "Motor yağı ve soğutma sıvısı kaçağını kontrol edin",
      "Test sürüşünde şanzıman sarsıntısı, direksiyon kayması ve fren sesini gözlemleyin",
    ],
  },
  {
    id: "dsg-gearbox",
    label: "DSG şanzıman",
    category: "automotive",
    match: /\bdsg\b/,
    specificity: 3,
    issues: [
      {
        id: "dsg-dry-clutch",
        issue: "Kuru kavramalı DSG şanzıman",
        riskLevel: "Orta",
        description:
          "Bazı 7 ileri kuru kavramalı DSG şanzımanlarda sarsıntı ve mekatronik arıza şikayetleri bildirilmiştir; şanzıman tipini doğrulayın, servis kaydını ve test sürüşünü dikkatle yapın.",
      },
    ],
    checks: ["Test sürüşünde düşük hızda kalkış ve vites geçişlerinde sarsıntı arayın"],
  },
  {
    id: "bmw-n47",
    label: "BMW N47 dizel motor",
    category: "automotive",
    match: /\bn47\b/,
    specificity: 3,
    issues: [
      {
        id: "n47-timing-chain",
        issue: "N47 zamanlama zinciri",
        riskLevel: "Yüksek",
        description:
          "2007-2012 arası N47 dizel motorlarda zamanlama zinciri aşınması ve kopması bildirilmiştir; soğuk çalıştırmada zincir sesine ve zincir değişim kaydına bakın.",
      },
    ],
    checks: ["Soğuk motor çalıştırırken zincir sesi dinleyin, zincir değişim kaydını isteyin"],
  },
  {
    id: "diesel-dpf",
    label: "Dizel motor",
    category: "automotive",
    match: /\b(dizel|diesel|tdi|dci|hdi|cdi|jtd|crdi)\b/,
    specificity: 2,
    issues: [
      {
        id: "dpf-egr",
        issue: "DPF / EGR tıkanması",
        riskLevel: "Orta",
        description:
          "Ağırlıklı şehir içi kısa mesafe kullanım partikül filtresi ve EGR tıkanmasına yol açabilir; uyarı lambalarına ve filtre iptali izlerine dikkat edin.",
      },
    ],
    checks: ["Gösterge panelinde motor ve DPF uyarı lambalarını kontrol edin"],
  },
  {
    id: "hybrid-ev",
    label: "Hibrit / elektrikli",
    category: "automotive",
    match: /\b(hybrid|hibrit|elektrikli|phev)\b/,
    specificity: 3,
    baseLifespanYears: 12,
    repair: {
      repairabilityScore: 4,
      commonReplacedParts: ["Yüksek voltaj batarya", "Şarj ünitesi"],
      aftermarketPartAvailability: "Zor",
      estimatedRepairCostRange: { min: 15000, max: 300000, currency: "TL" },
    },
    issues: [
      {
        id: "hv-battery",
        issue: "Yüksek voltaj batarya sağlığı",
        riskLevel: "Yüksek",
        description:
          "Hibrit ve elektrikli araçlarda yüksek voltaj pil sağlığı değerin büyük kısmını belirler; batarya sağlık raporu isteyin ve garanti durumunu doğrulayın.",
      },
    ],
    checks: ["Batarya sağlık raporunu (SoH) ve batarya garantisinin kalan süresini isteyin"],
  },

  // ───────────────────────── BEYAZ EŞYA ─────────────────────────
  {
    id: "appliance-default",
    label: "Beyaz eşya (genel)",
    category: "appliance",
    match: /./,
    specificity: 1,
    baseLifespanYears: 10,
    repair: {
      repairabilityScore: 6,
      commonReplacedParts: ["Elektronik kart", "Pompa", "Termostat", "Kapak contası"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 800, max: 12000, currency: "TL" },
    },
    issues: [
      {
        id: "age-wear",
        issue: "Yaşa bağlı genel aşınma",
        riskLevel: "Orta",
        description:
          "Beyaz eşya yaşlandıkça arıza sıklığı ve yedek parça maliyeti artar; üretim yılını etiket ya da seri numarasından doğrulayın.",
        ageEscalationYears: 8,
      },
      {
        id: "electronic-board",
        issue: "Elektronik kart arızaları",
        riskLevel: "Orta",
        description:
          "Elektronik kart (kontrol/inverter) arızaları sık görülen ve pahalı onarımlardır; tüm program ve göstergeleri deneyin.",
      },
      {
        id: "spare-parts",
        issue: "Yedek parça ve servis erişimi",
        riskLevel: "Düşük",
        description: "Eski ya da servisi kapanmış markalarda yedek parça bulmak zor olabilir.",
      },
    ],
    checks: [
      "Etiketten üretim yılını doğrulayın",
      "Tüm program ve fonksiyonları çalıştırıp deneyin",
      "Kapak contasında küf ve yırtık, güç kablosunda yanık izi arayın",
      "Çalışırken gürültü ve titreşimi dinleyin",
    ],
  },
  {
    id: "washing-machine",
    label: "Çamaşır makinesi",
    category: "appliance",
    match: /\bcamasir\b/,
    specificity: 3,
    baseLifespanYears: 10,
    issues: [
      {
        id: "bearing-damper",
        issue: "Rulman ve amortisör aşınması",
        riskLevel: "Orta",
        description:
          "Rulman ve amortisör aşınması sıkma sırasında gürültü ve titreşimle belli olur; sıkma programında dinleyin.",
      },
    ],
    checks: ["Sıkma programında gürültü, titreşim ve su kaçağı kontrolü yapın"],
  },
  {
    id: "dishwasher",
    label: "Bulaşık makinesi",
    category: "appliance",
    match: /\bbulasik\b/,
    specificity: 3,
    baseLifespanYears: 9,
    issues: [
      {
        id: "pump-leak",
        issue: "Pompa, filtre ve su kaçağı",
        riskLevel: "Orta",
        description: "Drenaj pompası, filtre ve conta sorunları su kaçağına yol açabilir; bir tam program çalıştırarak izleyin.",
      },
    ],
    checks: ["Tam program çalıştırıp su kaçağı ve kurutma performansını izleyin"],
  },
  {
    id: "fridge",
    label: "Buzdolabı",
    category: "appliance",
    match: /\bbuzdolabi\b/,
    specificity: 3,
    baseLifespanYears: 12,
    issues: [
      {
        id: "compressor-cooling",
        issue: "Kompresör ve soğutma sistemi",
        riskLevel: "Orta",
        description:
          "Kompresör arızası pahalıdır; her bölümün soğuduğunu ve kompresörün sürekli çalışmadığını kontrol edin. No-frost modellerde defrost/fan arızaları görülebilir.",
      },
    ],
    checks: ["En az 30 dakika çalıştırıp tüm bölümlerin soğuduğunu ve kompresör sesini kontrol edin"],
  },

  // ───────────────────────── GENEL ─────────────────────────
  {
    id: "general-default",
    label: "Genel ürün",
    category: "general",
    match: /./,
    specificity: 1,
    baseLifespanYears: 5,
    repair: {
      repairabilityScore: 5,
      commonReplacedParts: ["Parça bilgisi yok"],
      aftermarketPartAvailability: "Orta",
      estimatedRepairCostRange: { min: 500, max: 10000, currency: "TL" },
    },
    issues: [
      {
        id: "usage-wear",
        issue: "Kullanım yıpranması",
        riskLevel: "Orta",
        description: "İkinci el ürünlerde kullanıma bağlı yıpranma olabilir; tüm fonksiyonları elden deneyin.",
      },
      {
        id: "authenticity",
        issue: "Orijinallik ve kaynak doğrulaması",
        riskLevel: "Orta",
        description: "Ürünün orijinal olduğunu ve satıcının gerçek sahip olduğunu fatura ya da seri numarasıyla doğrulayın.",
      },
    ],
    checks: [
      "Tüm fonksiyonları elden deneyin",
      "Fatura, garanti ya da seri numarasıyla orijinalliği doğrulayın",
    ],
  },
];