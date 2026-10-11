"use client";

import React from "react";

export default function MarketplaceCard({ result, data }: any) {
  const item = result || data || {};
  const modelName = item.phoneName || "Apple iPhone 13 128 GB";
  const listPrice = Number(item.price) || 25000;
  
  // Platformlara özel tahmini fırsat fiyatları
  const sahibindenPrice = Math.round(listPrice * 0.92);
  const dolapPrice = Math.round(listPrice * 0.95);
  const letgoPrice = Math.round(listPrice * 0.88);

  const encodedQuery = encodeURIComponent(modelName);

  const platforms = [
    {
      name: "Sahibinden",
      logo: "🟡",
      estimatedPrice: sahibindenPrice,
      badge: "En Geniş İlan Portföyü",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      buttonColor: "bg-amber-500 hover:bg-amber-600 text-white",
      url: `https://www.sahibinden.com/kelime-ile-ara?query_text=${encodedQuery}`,
      riskNote: "Param Güvende veya elden test ederek teslim alın.",
      advantage: "Kutulu, faturalı ve garantili cihaz bulma şansı yüksek.",
    },
    {
      name: "Dolap",
      logo: "🟢",
      estimatedPrice: dolapPrice,
      badge: "Güvenli Kargo Alıcı Koruması",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
      url: `https://dolap.com/arama?q=${encodedQuery}`,
      riskNote: "Alıcı koruması ve iade imkanlarını sipariş öncesi inceleyin.",
      advantage: "Kargo kolaylığı ve kredi kartına taksit/ödeme güvencesi.",
    },
    {
      name: "Letgo",
      logo: "🔴",
      estimatedPrice: letgoPrice,
      badge: "En Yüksek Pazarlık Marjı",
      badgeColor: "bg-red-100 text-red-800 border-red-200",
      buttonColor: "bg-red-500 hover:bg-red-600 text-white",
      url: `https://www.letgo.com/search?q=${encodedQuery}`,
      riskNote: "Yalnızca elden, kamusal ve güvenli alanlarda buluşarak alın.",
      advantage: "Konuma yakın satıcılarla doğrudan hızlı elden pazarlık.",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>🛍️</span> Pazar Yeri Karşılaştırması & Canlı Fiyat Taraması
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          <strong>{modelName}</strong> için platformlardaki tahmini ortalama fırsat fiyatları ve canlı arama bağlantıları:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((p) => (
          <div
            key={p.name}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4 hover:shadow-md transition"
          >
            <div className="space-y-3">
              {/* Başlık ve Rozet */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.logo}</span>
                  <h4 className="text-base font-bold text-slate-800">{p.name}</h4>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                  {p.badge}
                </span>
              </div>

              {/* Tahmini Fiyat Görsel Kutusu */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center shadow-inner">
                <span className="text-xs text-slate-400 font-medium block">Ortalama İlan Fiyatı</span>
                <span className="text-xl font-extrabold text-slate-900">
                  ~{p.estimatedPrice.toLocaleString("tr-TR")} TL
                </span>
              </div>

              {/* Avantaj ve Risk */}
              <div className="space-y-1.5 text-xs">
                <p className="text-slate-600">
                  <strong className="text-slate-800">Öne Çıkan:</strong> {p.advantage}
                </p>
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 text-amber-900">
                  <strong>⚠️ Risk Uyarısı:</strong> {p.riskNote}
                </div>
              </div>
            </div>

            {/* Yönlendirme Butonu */}
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full text-center text-xs font-semibold py-2.5 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 ${p.buttonColor}`}
            >
              <span>{p.name}'da Canlı İlanları İncele</span>
              <span>↗</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}