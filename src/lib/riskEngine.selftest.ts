// src/lib/riskEngine.selftest.ts
// Risk motoru kendi kendini sınama dosyası. Uygulamaya dahil edilmez; yalnızca elle çalıştırılır:
//   npx.cmd tsx src/lib/riskEngine.selftest.ts
// Bir ya da daha fazla durum başarısız olursa hata fırlatır (çıkış kodu 0 olmaz).

import { buildRiskReport, validateImei } from "./riskEngine";
import type { RiskCategoryId, RiskInput } from "./riskEngine";

const CATS: RiskCategoryId[] = ["imei", "fraud", "parts", "screen", "battery", "warranty"];

function ids(description: string, extra: Partial<RiskInput> = {}): Set<string> {
  const r = buildRiskReport({ model: "iPhone 13", description, ...extra });
  const out = new Set<string>();
  for (const c of CATS) for (const s of r.categories[c].signals) out.add(s.id);
  return out;
}

let failed = 0;
let passed = 0;

function expectFired(text: string, id: string, extra: Partial<RiskInput> = {}) {
  if (ids(text, extra).has(id)) passed++;
  else {
    failed++;
    console.log(`BAŞARISIZ (olmalıydı: ${id}): "${text}"`);
  }
}
function expectNot(text: string, id: string, extra: Partial<RiskInput> = {}) {
  if (!ids(text, extra).has(id)) passed++;
  else {
    failed++;
    console.log(`BAŞARISIZ (olmamalıydı: ${id}): "${text}"`);
  }
}

// ── Olumsuzlama: yanlış pozitifler olmamalı ──
expectNot("Çalıntı değildir, faturalı", "imei-engelli");
expectNot("Karalistede değil, IMEI kayıtlı", "imei-engelli");
expectNot("Kara listede değildir", "imei-engelli");
expectNot("Kapora istemiyorum, elden teslim", "fraud-kapora");
expectNot("Kapora almam", "fraud-kapora");
expectNot("Kapora yok", "fraud-kapora");
expectNot("Ekranı değişmedi, orijinal", "ekran-degismis");
expectNot("Ekran değişmedi", "ekran-degismis");
expectNot("Kasa değişmedi", "parca-kasa-kamera");
expectNot("Pil servis uyarısı yok", "pil-servis");
expectNot("Önemli pil mesajı yok", "pil-servis");
expectNot("İthalatçı garantili", "yurtdisi");
expectNot("Yurt dışında olduğum için elden veremiyorum", "yurtdisi");
expectNot("Ekran kırık değil", "ekran-kirik");
expectNot("Ekranda çatlak yok", "ekran-kirik");
expectNot("Ekranında kırık yok", "ekran-kirik");
expectNot("Kırık, çatlak, çizik, leke yok", "ekran-kirik");
expectNot("Kırık, çatlak, çizik, leke yok", "ekran-cizik");
expectNot("Kırık, çatlak, çizik, leke yok", "ekran-yanik");
expectNot("Dikey çizgi yok", "ekran-cizgi");
expectNot("Yeşil çizgi yok", "ekran-cizgi");
expectNot("Su görmedi, anakart onarımı yok", "parca-su");
expectNot("Su görmedi, anakart onarımı yok", "parca-anakart");
expectNot("Tamir edilmedi", "parca-servis");
expectNot("Hiç açılmadı, tamir görmedi", "parca-servis");
expectNot("iCloud kilidi yok", "kilit-hesap");
expectNot("iCloud kilitli değil", "kilit-hesap");
expectNot("iCloud kilit durumu temiz", "kilit-hesap");
expectNot("MDM yok, kurumsal hesap yok", "kilit-hesap");
expectNot("Arka cam çatlak", "ekran-kirik");
expectNot("Kamera camı kırık", "ekran-kirik");
expectNot("Yurt dışı değil, TR cihazı", "yurtdisi");
expectNot("IMEI değişmedi", "imei-klon");
expectNot("Pili yenilenmedi", "pil-degismis");

// ── Olumsuzlama: gerçek riskler kaçmamalı ──
expectFired("Çalıntı", "imei-engelli");
expectFired("Karalistede", "imei-engelli");
expectFired("Cihaz kayıtlı değildir", "imei-engelli");
expectFired("Kayıtlı değil", "imei-engelli");
expectFired("iCloud kilidi var", "kilit-hesap");
expectFired("iCloud kilitli", "kilit-hesap");
expectFired("iCloud şifresini bilmiyorum", "kilit-hesap");
expectFired("Find My açık", "kilit-hesap");
expectFired("Operatör kilitli", "operator-kilit");
expectFired("Operatör kilidi var", "operator-kilit");
expectFired("Ekranda çatlak var", "ekran-kirik");
expectFired("Ekranında kırık var", "ekran-kirik");
expectFired("Ekran kırık", "ekran-kirik");
expectFired("Ekranın sağ üst köşesi çatlak var", "ekran-kirik");
expectFired("Ekran kırık, kasa çizik yok", "ekran-kirik");
expectFired("Ekran kırık, değişen yok", "ekran-kirik");
expectFired("Ekran kırık, boya yok", "ekran-kirik");
expectFired("Ekran kırık ama çizik yok", "ekran-kirik");
expectFired("Çizik var, kasa değişen yok", "ekran-cizik");
expectFired("Ekranı değişti", "ekran-degismis");
expectFired("Kasa değişti", "parca-kasa-kamera");
expectFired("Kamera camı kırık", "parca-kamera-cam");
expectFired("Arka cam çatlak", "parca-hafif");
expectFired("Pil servis uyarısı veriyor", "pil-servis");
expectFired("Kapora gerekli", "fraud-kapora");
expectFired("Ön ödeme istiyorum", "fraud-kapora");
expectFired("Son fiyat, pazarlık yok, acil", "fraud-baski");
expectFired("Elden teslim yok, sadece kargo", "fraud-kargo-only");
expectFired("İade yok", "fraud-iade-yok");
expectFired("Yurt dışı cihaz", "yurtdisi");
expectFired("Yurt dışından getirildi", "yurtdisi");
expectFired("İthal cihaz", "yurtdisi");
expectFired("Anakart onarımı yapıldı", "parca-anakart");
expectFired("Su gördü", "parca-su");
expectFired("Tamir edildi", "parca-servis");
expectFired("Servise gitti", "parca-servis");
expectFired("Yeşil çizgi var", "ekran-cizgi");
expectFired("Face ID yok", "ekran-sensor");
expectFired("Ekran orijinal değil", "ekran-muadil");
expectFired("Pili değişmiş", "pil-degismis");
expectFired("Yenilenmiş cihaz", "yenilenmis");
expectFired("Faturası yok", "fatura-yok");
expectFired("Garantisi yok", "garanti-yok");
expectFired("Kutusu yok", "kutu-yok");
expectFired("IBAN'a havale yapın", "fraud-odeme-disi");

// ── Olumlu beyanlar ──
expectFired("Çalıntı değildir, faturalı", "imei-pozitif");
expectFired("Kilidi yok, hesaplar silindi", "kilitsiz-pozitif");
expectFired("Değişen yok, boyasız, orijinal", "parca-pozitif");
expectFired("Ekranı değişmedi", "parca-pozitif");
expectFired("Ekranda kırık, çizik yok", "ekran-pozitif");
expectFired("İthalatçı garantili", "garanti-pozitif");

// ── Pil yüzdesi olumsuzlamadan etkilenmemeli ──
expectFired("Pil sağlığı %87, kırık çizik yok", "pil-iyi");
expectFired("Pil 82 ekran kırık değil", "pil-sinir");
expectFired("Pil 85 ekran kırık değil", "pil-iyi");

// ── IMEI ──
{
  const ok = validateImei("490154203237518");
  if (ok && ok.valid) passed++;
  else {
    failed++;
    console.log("BAŞARISIZ: geçerli IMEI reddedildi");
  }
  const bad = validateImei("490154203237519");
  if (bad && !bad.valid) passed++;
  else {
    failed++;
    console.log("BAŞARISIZ: geçersiz IMEI kabul edildi");
  }
}

// ── Genel akış: temiz ilan "kaçın" çıkmamalı, kritik ilan çıkmalı ──
{
  const clean = buildRiskReport({ model: "iPhone 13", description: "Çalıntı değildir, kapora istemiyorum, ekran kırık değil, elden teslim." });
  if (clean.advice !== "kacin") passed++;
  else {
    failed++;
    console.log("BAŞARISIZ: dürüst satıcı metni 'kaçın' çıktı");
  }
  const bad = buildRiskReport({ model: "iPhone 13", description: "Kapora gerekli, sadece kargo, IBAN verdim." });
  if (bad.advice === "kacin") passed++;
  else {
    failed++;
    console.log("BAŞARISIZ: kapora + kargo ilanı 'kaçın' çıkmadı");
  }
}

console.log(`Geçen: ${passed}, başarısız: ${failed}`);
if (failed > 0) throw new Error(`${failed} sınama başarısız`);