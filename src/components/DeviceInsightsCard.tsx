"use client";

import React from "react";

export default function DeviceInsightsCard({ result, data }: any) {
  const item = result || data || {};
  const modelName = item.phoneName || "Apple iPhone 13 128 GB";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md space-y-5">
      {/* Başlık ve Rozet */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            💡 AI Model Analizi & Piyasa Yorumları
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            <strong>{modelName}</strong> için kronik durumlar, kullanıcı deneyimleri ve likidite
          </p>
        </div>
        <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
          🔥 Yüksek İkinci El Talebi
        </span>
      </div>

      {/* 3 Ana Metrik Kartı */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Likidite */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Satış Hızı</span>
          <p className="text-sm font-bold text-slate-800">⚡ Hızlı El Değiştirir</p>
          <p className="text-[11px] text-slate-500">Doğru fiyata koyulduğunda 1-3 gün içinde satılır.</p>
        </div>

        {/* Amortisman / Değer Kaybı */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Değer Koruma</span>
          <p className="text-sm font-bold text-emerald-600">🛡️ Yüksek (Piyasa Güçlü)</p>
          <p className="text-[11px] text-slate-500">Enflasyonist ortamda değerini en iyi koruyan modellerden.</p>
        </div>

        {/* Kullanıcı Memnuniyeti */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kullanıcı Skoru</span>
          <p className="text-sm font-bold text-amber-600">⭐ 4.7 / 5.0</p>
          <p className="text-[11px] text-slate-500">Genel kullanıcı memnuniyeti oldukça yüksek.</p>
        </div>
      </div>

      {/* Kronik Dikkat Edilecekler */}
      <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-2">
        <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
          <span>⚠️</span> Bu Modelde İkinci Elde En Çok Karşılaşılan Durumlar
        </h4>
        <ul className="text-xs text-amber-900/90 space-y-1 list-disc list-inside leading-relaxed">
          <li>Pil sağlığı %80 altına düştüğünde işlemci performansında yavaşlama hissedilebilir.</li>
          <li>Ekran değişimi yapılmışsa True Tone ve Face ID özelliklerinin aktifliği mutlaka test edilmelidir.</li>
          <li>Kasa kenarlarında kılıf kullanımına bağlı kılcal sürtünme izleri kontrol edilmelidir.</li>
        </ul>
      </div>
    </div>
  );
}