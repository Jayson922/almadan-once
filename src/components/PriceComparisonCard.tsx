"use client";

import React from "react";

export default function PriceComparisonCard({ result }: any) {
  if (!result) return null;

  const {
    phoneName,
    price,
    marketPriceMin,
    marketPriceAvg,
    marketPriceMax,
    fairPrice,
    priceVerdict,
    priceVerdictColor,
    priceAnalysisNote,
    dataPoints,
  } = result;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-6">
      {/* İlan Fiyat Durumu ve Uyarı Rozeti */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
            📊 CANLI PİYASA TARAMASI VE UYARI MOTORU
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-0.5">{phoneName}</h3>
        </div>

        <div className={`px-4 py-2 rounded-2xl border text-xs sm:text-sm shadow-sm ${priceVerdictColor}`}>
          {priceVerdict}
        </div>
      </div>

      {/* Fiyat İstatistik Kutuları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase block">İlandaki Fiyat</span>
          <p className="text-lg font-black text-slate-900 mt-1">
            {price ? `${Number(price).toLocaleString("tr-TR")} TL` : "Belirtilmedi"}
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase block">En Düşük Piyasa</span>
          <p className="text-lg font-black text-slate-700 mt-1">
            {Number(marketPriceMin).toLocaleString("tr-TR")} TL
          </p>
        </div>

        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
          <span className="text-[10px] font-extrabold text-blue-600 uppercase block">Piyasa Ortalaması</span>
          <p className="text-lg font-black text-blue-900 mt-1">
            {Number(marketPriceAvg).toLocaleString("tr-TR")} TL
          </p>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
          <span className="text-[10px] font-extrabold text-emerald-600 uppercase block">AI Hedef Teklif</span>
          <p className="text-lg font-black text-emerald-900 mt-1">
            {Number(fairPrice).toLocaleString("tr-TR")} TL
          </p>
        </div>
      </div>

      {/* Fiyat Analiz Notu */}
      {priceAnalysisNote && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
          <span className="font-bold block text-slate-900">💡 Yapay Zeka Analizi:</span>
          <p>{priceAnalysisNote}</p>
        </div>
      )}

      {/* FİYATIN HANGİ VERİLERE DAYANDIĞI (DATA POINTS) */}
      {dataPoints && dataPoints.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <span>📌</span> Bu Değerlendirme Hangi Verilere Dayanıyor?
          </h4>
          <ul className="space-y-2">
            {dataPoints.map((point: string, idx: number) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-blue-600 font-bold">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}