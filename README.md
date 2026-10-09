# ALMADAN ÖNCE

İkinci el ürünü satın almadan önce fiyatını ve ilanını kontrol etmeye yardımcı olan web uygulaması.

> **Durum: MVP (demo).** Şu anda gerçek bir analiz yapılmıyor. Sonuç ekranındaki bilgiler sabit bir demo verisidir ve arayüzde de DEMO olarak işaretlenir.

## Şu an çalışanlar

- İlan ekran görüntüsü yükleme (tıkla veya sürükle-bırak; JPG, JPEG, PNG, WEBP; en fazla 5 MB)
- Önizleme, dosya adı, boyut, kaldırma
- "Analiz Et" ile sunucu rotasına (`/api/analyze`) istek ve demo sonuç kartı
- Dosya tipi ve boyutu hem tarayıcıda hem sunucuda kontrol edilir

## Çalıştırma

Gereksinimler: Node.js 20.19 veya üstü (22.13+ önerilir), npm, Git.

    npm install
    npm run dev

Tarayıcıda http://localhost:3000 adresini aç.

Windows PowerShell'de `npm` komutu bazen çalışmaz. Bu durumda `npm.cmd` kullan.

Diğer komutlar:

    npm run lint
    npm run build

## Klasör yapısı

- `src/app`: sayfalar ve API rotası (`api/analyze/route.ts`)
- `src/components`: arayüz bileşenleri (`ImageUploader`, `ResultCard`)
- `src/lib`: yardımcı fonksiyonlar (`validateImage`, `mockAnalyze`)
- `src/types`: ortak tip tanımları (`AnalysisResult`)

## Gizli bilgiler

API anahtarları koda yazılmaz. `.env.example` dosyasını `.env.local` olarak kopyalayıp orada doldur. `.env.local` Git'e girmez.

## TODO

- [ ] Gerçek görsel analizi (ilandan marka, model, depolama, fiyat çıkarma)
- [ ] Telefon için piyasa fiyat verisi ve fiyat değerlendirmesi
- [ ] Risk kontrol listesi ve satıcıya sorulacak sorular
- [ ] Görsellerin gizliliği: kişisel bilgi içerebilir, saklama ve loglama politikası
- [ ] Kategori yapısı (otomobil, bilgisayar, tablet vb. için)
- [ ] Veritabanı (PostgreSQL), kullanıcı hesabı
- [ ] Testler