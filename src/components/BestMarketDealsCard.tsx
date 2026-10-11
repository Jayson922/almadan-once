"use client";

import React from "react";

export default function BestMarketDealsCard({ result }: any) {
  const deals = result?.bestDeals || [];
  const phoneName = result?.phoneName || "Cihaz";
  const userPrice = result?.price || 0;

  if (!deals || deals.length === 0) return null;

  // Platform bazlı görsel tema eşleştirmesi
  const getPlatformStyle = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("sahibinden")) {
      return {
        bg: "from-amber-500/10 to-amber-500/5",
        border: "border-amber-200 hover:border-amber-400",
        tagBg: "bg-amber-100 text-amber-900 border-amber-300",
        badge: "💛 Sahibinden Bireysel",
        accent: "text-amber-600",
      };
    } else if (p.includes("easycep") || p.includes("getmobil") || p.includes("yenilenmiş")) {
      return {
        bg: "from-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-200 hover:border-emerald-400",
        tagBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
        badge: "🛡️ 12 Ay Mağaza Garantili",
        accent: "text-emerald-600",
      };
    } else if (p.includes("dolap")) {
      return {
        bg: "from-pink-500/10 to-pink-500/5",
        border: "border-pink-200 hover:border-pink-400",
        tagBg: "bg-pink-100 text-pink-900 border-pink-300",
        badge: "💗 Dolap İkinci El",
        accent: "text-pink-600",
      };
    } else {
      return {
        bg: "from-blue-500/10 to-blue-500/5",
        border: "border-blue-200 hover:border-blue-400",
        tagBg: "bg-blue-100 text-blue-900 border-blue-300",
        badge: "🔵 Canlı İlan Pazarı",
        accent: "text-blue-600",
      };
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/50 to-white p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
      {/* Şık Arka Plan Efekti */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 opacity-70 pointer-events-none" />

      {/* Kart Başlığı ve Canlı Radar Modülü */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest block">
              CANLI AI PAZAR YERİ RADARI & CANLI FIRSATLAR
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {phoneName}
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            Yapay zeka Türkiye genelinde anlık piyasa taraması yaparak en avantajlı alım kanallarını eşleştirdi.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-extrabold shadow-md self-start sm:self-auto">
          <span>📡 Canlı Piyasa Taraması Aktif</span>
        </div>
      </div>

      {/* Fırsat Kartları Izgarası */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deals.map((deal: any, index: number) => {
          const style = getPlatformStyle(deal.platform);
          const dealPrice = Number(deal.price) || 0;
          const priceDiff = userPrice > 0 ? userPrice - dealPrice : 0;

          return (
            <div
              key={index}
              className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between space-y-4 relative group`}
            >
              {/* Üst Rozet & Etiket */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${style.tagBg}`}>
                    {style.badge}
                  </span>
                  {deal.badge && (
                    <span className="text-[10px] font-black text-slate-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-200">
                      {deal.badge}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-black text-slate-900 line-clamp-2 mt-1">
                  {deal.title}
                </h4>
              </div>

              {/* Fiyat ve Tasarruf Bilgisi */}
              <div className="pt-3 border-t border-slate-200/60 space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                      Ortalama Piyasa Fiyatı
                    </span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">
                      {dealPrice.toLocaleString("tr-TR")} TL
                    </span>
                  </div>

                  {priceDiff > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] font-extrabold text-emerald-600 block uppercase">
                        Tahmini Tasarruf
                      </span>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        -{priceDiff.toLocaleString("tr-TR")} TL
                      </span>
                    </div>
                  )}
                </div>

                {/* Eylem Butonu */}
                <a
                  href={deal.link || "https://www.google.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-slate-900 hover:bg-blue-600 text-white text-xs font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                >
                  <span>Pazarı İncele & Teklif Ver</span>
                  <span className="text-sm group-hover:translate-x-1 transition-transform">➔</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Bilgilendirme ve Güvence Şeridi */}
      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-[11px] font-extrabold text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Sahibinden Bireysel İlanlar
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            EasyCep / Getmobil Mağaza Garantililer
          </span>
        </div>
        <span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          💡 Yapay Zeka Risk & Fiyat Optimizasyonlu
        </span>
      </div>
    </div>
  );
}