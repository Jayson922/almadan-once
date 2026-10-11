'use client';

import { useState } from 'react';

export default function Page() {
  const [activeTab, setActiveTab] = useState<'manuel' | 'link'>('manuel');
  
  const [modelName, setModelName] = useState<string>('Apple iPhone 12 64 GB');
  const [price, setPrice] = useState<string>('30000');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['Kutulu & Faturalı', 'Pil %85+']);
  const [notes, setNotes] = useState<string>('');
  const [image, setImage] = useState<string | null>(null);
  const [rawParserText, setRawParserText] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleFeature = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feature));
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleParseText = async () => {
    if (!rawParserText.trim()) return;
    setParsing(true);
    setError(null);

    try {
      const res = await fetch('/api/ekspertiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse_text', rawText: rawParserText })
      });
      const data = await res.json();
      if (data.success && data.parsed) {
        if (data.parsed.modelName) setModelName(data.parsed.modelName);
        if (data.parsed.price) setPrice(String(data.parsed.price));
        if (data.parsed.notes) setNotes(data.parsed.notes);
        setActiveTab('manuel');
      } else {
        setError('İlan metni çözümlenemedi.');
      }
    } catch (err) {
      setError('Ayrıştırma sırasında bağlantı hatası.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ekspertiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName,
          price: Number(price),
          features: selectedFeatures,
          notes,
          image,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Analiz sırasında hata oluştu.');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const featureOptions = [
    'Kutulu & Faturalı', 'Pil %85+', 'Değişensiz / Orijinal', 'Garantisi Var',
    'Face ID / True Tone Aktif', 'Çizikler Var', 'Ufak Çizikler Var', 'Pil Değişmiş',
  ];

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
        
        <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold tracking-wider text-blue-600 uppercase">
              OTOMATİK AI EKSPERTİZ & SORGULAMA MOTORU
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              Cihaz İnceleme ve Pazar Taraması
            </h1>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('manuel')}
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'manuel' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
            >
              Manuel Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`px-4 py-2 rounded-lg transition ${activeTab === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
            >
              ⚡ Akıllı İlan / Link Yapıştır
            </button>
          </div>
        </div>

        {activeTab === 'link' && (
          <div className="mb-6 p-5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-3">
            <h3 className="font-bold text-blue-900 text-sm">İlan Açıklamasını veya Metnini Yapıştırın</h3>
            <p className="text-xs text-blue-700">İlan metnini aşağıya yapıştırın, yapay zeka formu otomatik doldursun.</p>
            <textarea
              rows={4}
              value={rawParserText}
              onChange={(e) => setRawParserText(e.target.value)}
              placeholder="Örn: Temiz iPhone 12 64gb kutulu faturalı..."
              className="w-full px-4 py-2.5 rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 bg-white outline-none text-sm text-gray-900"
            />
            <button
              type="button"
              onClick={handleParseText}
              disabled={parsing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow transition disabled:opacity-50"
            >
              {parsing ? 'Yapay Zeka Metni Çözümlüyor...' : 'Metni Analiz Et ve Formu Doldur'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50/50 relative">
            {image ? (
              <div className="relative inline-block">
                <img src={image} alt="Cihaz Görseli" className="h-48 rounded-lg object-contain mx-auto shadow-sm" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md shadow hover:bg-red-700 transition"
                >
                  Kaldır
                </button>
              </div>
            ) : (
              <div>
                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-100 transition">
                  <span>Görsel Yükle</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-2">Cihazın net bir fotoğrafını yükleyin</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                İNCELENECEK CİHAZ MODELİ
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                İLANDAKİ İSTENEN FİYAT (TL)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              CİHAZIN BİLİNEN ÖZELLİKLERİ
            </label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((feat) => {
                const isSelected = selectedFeatures.includes(feat);
                return (
                  <button
                    type="button"
                    key={feat}
                    onClick={() => toggleFeature(feat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                      isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isSelected ? `✓ ${feat}` : `+ ${feat}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              SATICI NOTU / İLAN AÇIKLAMASI
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Satıcının yazdığı açıklamayı buraya yapıştırın..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? 'Yapay Zeka Analiz Ediyor, Lütfen Bekleyin...' : '⚡ YAPAY ZEKA EKSPERTİZ & PAZAR TARAMASINI BAŞLAT'}
          </button>
        </form>

        {/* Sonuç ve Detaylı Rapor Kartları */}
        {result && (
          <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">Yapay Zeka Profesyonel Ekspertiz Raporu</h3>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${
                result.tavsiye === 'Kesin Al' ? 'bg-green-100 text-green-700 border border-green-200' : 
                result.tavsiye === 'Uzak Dur' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
              }`}>
                Tavsiye: {result.tavsiye}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-blue-50/70 border border-blue-100 rounded-xl">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Arbitraj / Fırsat Skoru</p>
                <p className="text-3xl font-black text-blue-900 mt-1">{result.arbitrajSkoru} <span className="text-lg font-normal text-blue-700">/ 100</span></p>
              </div>
              <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tahmini Piyasa Aralığı</p>
                <p className="text-lg font-extrabold text-gray-900 mt-1">
                  {Number(result.tahminiPiyasaMin).toLocaleString('tr-TR')} TL - {Number(result.tahminiPiyasaMax).toLocaleString('tr-TR')} TL
                </p>
              </div>
            </div>

            {/* 1. Platform Karşılaştırması */}
            {result.platformKarsilastirmasi && (
              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wider">1. En Uygun İlan Yerleri ve Piyasa Karşılaştırması</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.platformKarsilastirmasi.map((item: any, index: number) => (
                    <div key={index} className="bg-white p-3.5 rounded-lg border border-indigo-100 shadow-sm">
                      <p className="font-bold text-gray-800 text-sm">{item.platform}</p>
                      <p className="text-indigo-600 font-semibold text-sm mt-0.5">{item.ortalamaFiyat}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.not}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Teknik Değerlendirme */}
            {result.teknikDegerlendirme && (
              <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider">2. Teknik Değerlendirme ve Mühendislik Analizi</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong className="text-gray-900">Kozmetik Durum:</strong> {result.teknikDegerlendirme.kozmetikDurum}</p>
                  <p><strong className="text-gray-900">Donanım / İç Aksam:</strong> {result.teknikDegerlendirme.donanimDurum}</p>
                  <p><strong className="text-gray-900">Fiyat Mantığı:</strong> {result.teknikDegerlendirme.fiyatMantigi}</p>
                </div>
              </div>
            )}

            {/* 3. Risk Raporu */}
            {result.riskRaporu && result.riskRaporu.length > 0 && (
              <div className="p-5 bg-red-50/50 border border-red-100 rounded-xl">
                <h4 className="font-bold text-red-800 text-sm mb-2 uppercase tracking-wider">3. Risk Raporu ve Güvenlik Analizi</h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1.5">
                  {result.riskRaporu.map((risk: string, index: number) => (
                    <li key={index}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}