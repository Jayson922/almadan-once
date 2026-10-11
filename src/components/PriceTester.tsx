'use client';
import { useState } from 'react';

export default function PriceTester() {
  const [deviceModel, setDeviceModel] = useState('Apple iPhone 13 128 GB');
  const [price, setPrice] = useState('25000');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, deviceModel, price }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setErrorMsg('Yapay zeka analizi sırasında bir hata oluştu.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Bağlantı hatası: Sunucu yanıt vermiyor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-6">
      
      {/* İlan Linki ile Otomatik Analiz Alanı */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          🔗 İlan Bağlantısı (URL) ile Otomatik Analiz
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.sahibinden.com/ilan/..."
            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-slate-800"
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          İlan linkini yapıştırarak bilgileri otomatik çekebilirsiniz.
        </p>
      </div>

      {/* Model ve Fiyat Alanları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">İncelenecek Cihaz Modeli</label>
          <input
            type="text"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">İlandaki İstenen Fiyat (TL)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Hata Mesajı Alanı (Eski sabit kırmızı uyarı yerine dinamik) */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          ❌ {errorMsg}
        </div>
      )}

      {/* Başlat Butonu */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
      >
        {loading ? '⚡ Yapay Zeka Taraması Yapılıyor...' : '⚡ YAPAY ZEKA EKSPERTİZ & PAZAR TARAMASINI BAŞLAT'}
      </button>

      {/* Yapay Zeka Sonuç Raporu */}
      {result && (
        <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4 animate-fadeIn">
          <h3 className="text-lg font-bold text-indigo-400">🤖 Yapay Zeka Teknik Ekspertiz Raporu</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Algılanan Cihaz:</span>
              <p className="font-semibold">{result.extractedTitle}</p>
            </div>
            <div>
              <span className="text-slate-400">Piyasa Değerlemesi:</span>
              <p className="font-semibold text-emerald-400">₺{result.estimatedMarketPrice}</p>
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-sm">Teknik Yorumlar ve Risk Analizi:</span>
            <ul className="list-disc list-inside mt-2 text-sm text-slate-200 space-y-1">
              {result.riskAnalysis?.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}