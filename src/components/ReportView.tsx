"use client";

import React, { useState } from "react";

interface ReportViewProps {
  report: {
    productName: string;
    listingPrice: number;
    marketPrice: { min: number; max: number; median: number; currency: string } | null;
    verdict: "great_deal" | "fair" | "expensive" | "unknown";
    recommendation: string;
    confidence: number;
    summary: string;
    technicalComments: string;
    riskAnalysis: string[];
    checklist: string[];
    bargainingPlan: {
      targetOffer: number;
      walkAwayPrice: number;
      tactics: string[];
    };
    betterAlternatives?: Array<{
      title: string;
      price: number;
      source: string;
      advantage: string;
      searchQuery: string;
      url?: string;
    }>;
    alternatives: string[];
    basis?: {
      usedCount: number;
      notes: string;
      sources: string[];
    };
  };
}

export default function ReportView({ report }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "technical" | "risk" | "checklist" | "bargaining" | "basis">("summary");
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getVerdictDetails = (v: string) => {
    switch (v) {
      case "great_deal":
        return {
          badge: "🔥 BÜYÜK FIRSAT",
          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          actionText: "Kesinlikle Alınabilir (Fiyat Avantajlı)",
        };
      case "fair":
        return {
          badge: "⚖️ ADİL FİYAT",
          color: "bg-blue-500/20 text-blue-400 border-blue-500/40",
          actionText: "Değerlendirilebilir (Piyasa Seviyesinde)",
        };
      case "expensive":
        return {
          badge: "⚠️ PAHALI",
          color: "bg-amber-500/20 text-amber-400 border-amber-500/40",
          actionText: "Pazarlık Yapılmalı veya Uzak Durulmalı",
        };
      default:
        return {
          badge: "❓ BİLİNMİYOR",
          color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
          actionText: "Veri Yetersiz / Detaylı İnceleme Şart",
        };
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("tr-TR").format(amount) + " TL";
  };

  const verdictInfo = getVerdictDetails(report.verdict);

  return (
    <div className="space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
      
      {/* 30 SANİYEDE ÜRÜN ÖZET KARTI */}
      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">30 Saniyede Ürün Analizi</div>
            <h2 className="text-xl font-extrabold text-white mt-1">{report.productName}</h2>
          </div>
          <div className={`px-4 py-1.5 rounded-full border text-xs font-bold ${verdictInfo.color}`}>
            {verdictInfo.badge} — {verdictInfo.actionText}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">İstenen Fiyat</div>
            <div className="text-xl font-black text-indigo-400">{formatMoney(report.listingPrice)}</div>
          </div>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-1">
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider">Tahmini Piyasa Aralığı</div>
            <div className="text-base font-bold text-emerald-300">
              {report.marketPrice ? `${formatMoney(report.marketPrice.min)} - ${formatMoney(report.marketPrice.max)}` : "Hesaplanıyor..."}
            </div>
            <div className="text-[10px] text-zinc-500">Medyan: {report.marketPrice ? formatMoney(report.marketPrice.median) : "-"}</div>
          </div>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-1">
            <div className="text-[10px] text-violet-400 uppercase tracking-wider">Güvenilirlik & Veri</div>
            <div className="text-base font-bold text-violet-300">%{report.confidence} Güven Skoru</div>
            <div className="text-[10px] text-zinc-500">{report.basis?.usedCount || 0} İlan Analiz Edildi</div>
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-2">
          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">💡 Alıcı İçin Sonuç & Strateji</div>
          <p className="text-xs text-zinc-200 leading-relaxed">{report.recommendation}</p>
        </div>
      </div>

      {/* Navigasyon Sekmeleri */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3 text-xs">
        {[
          { id: "summary", label: "📊 Genel Özet Detayı" },
          { id: "technical", label: "🛠️ Teknik Rapor" },
          { id: "risk", label: "⚠️ Risk Analizi" },
          { id: "checklist", label: "✅ Elden Kontrol Listesi" },
          { id: "bargaining", label: "🤝 Pazarlık & En İyi 4 Alternatif" },
          { id: "basis", label: "🔍 Veri Dayanağı" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sekme İçerikleri */}
      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 space-y-4 min-h-[200px]">
        
        {activeTab === "summary" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Ürün Durum ve Piyasa Özeti</h3>
            <p className="text-sm text-zinc-200 leading-relaxed bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              {report.summary}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400">✨ Öne Çıkan Avantajlar</span>
                <p className="text-xs text-zinc-300">Piyasa medyanına göre fiyat konumu ve cihaz donanım standartları uyumlu.</p>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-rose-400">⚠️ Eksik Veriler & Riskler</span>
                <p className="text-xs text-zinc-300">Pil sağlığı ve donanım orijinal parça durumu elenmeden kesin karar verilmemelidir.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "technical" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Donanım ve Teknik Değerlendirme</h3>
            <p className="text-sm text-zinc-200 leading-relaxed bg-zinc-900 p-4 rounded-xl border border-zinc-800 whitespace-pre-line">
              {report.technicalComments}
            </p>
          </div>
        )}

        {activeTab === "risk" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Potansiyel Riskler ve Dikkat Edilmesi Gerekenler</h3>
            <ul className="space-y-2">
              {report.riskAnalysis.map((risk, index) => (
                <li key={index} className="flex items-start gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-200">
                  <span className="text-rose-400 font-bold">⚠️</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "checklist" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Elden Teslim Alırken Kontrol Edilecekler</h3>
            <p className="text-xs text-zinc-400">Cihazı elden teslim alırken maddeleri tek tek kontrol edip onaylayın:</p>
            <ul className="space-y-2">
              {report.checklist.map((item, index) => {
                const isChecked = checkedItems[index];
                return (
                  <li
                    key={index}
                    onClick={() => toggleCheck(index)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-xs ${
                      isChecked
                        ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300 line-through"
                        : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? "bg-emerald-600 border-emerald-500 text-white" : "border-zinc-600"}`}>
                      {isChecked && "✓"}
                    </span>
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === "bargaining" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Pazarlık Stratejisi ve Taktikler</h3>
              <ul className="space-y-2">
                {report.bargainingPlan.tactics.map((tactic, index) => (
                  <li key={index} className="flex items-start gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-200">
                    <span className="text-indigo-400 font-bold">💡</span>
                    <span>{tactic}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-6 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  🔥 Bu Fiyata Daha İyi / Uygun 4 Alternatif İlan Yönlendirmesi
                </h3>
                <span className="text-[10px] text-zinc-400">Pazar Karşılaştırması</span>
              </div>
              <p className="text-xs text-zinc-400">
                Mevcut ilana <strong>{formatMoney(report.listingPrice)}</strong> vermek yerine, piyasada aynı donanıma sahip veya daha avantajlı şu 4 alternatifi doğrudan inceleyebilirsiniz:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {report.betterAlternatives && report.betterAlternatives.length > 0 ? (
                  report.betterAlternatives.map((alt, index) => {
                    const redirectUrl = alt.url || `https://www.google.com/search?q=${encodeURIComponent(alt.searchQuery || alt.title)}`;
                    return (
                      <a
                        key={index}
                        href={redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-zinc-900 hover:bg-zinc-850 p-4 rounded-xl border border-zinc-800 hover:border-indigo-500/60 flex flex-col justify-between space-y-3 transition shadow-md"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-semibold border border-indigo-500/30">
                              {alt.source || "Pazar İlanı"}
                            </span>
                            <span className="text-sm font-extrabold text-emerald-400">
                              {formatMoney(alt.price)}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white pt-1 group-hover:text-indigo-300 transition">{alt.title}</h4>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">✨ {alt.advantage}</p>
                        </div>
                        <div className="inline-flex items-center justify-between w-full text-[11px] font-semibold text-indigo-400 pt-2 border-t border-zinc-800/80">
                          <span>🔍 İlanı Web'de İncele / Ara</span>
                          <span className="transform group-hover:translate-x-1 transition">→</span>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-500 col-span-full bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center">
                    Bu bütçeye uygun aktif alternatif ilan eşleşmesi bulunamadı.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "basis" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Şeffaf Veri Dayanağı (Data Basis)</h3>
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-3 text-xs text-zinc-300">
              <p><strong>Analiz Notu:</strong> {report.basis?.notes || "Özel piyasa verileri baz alındı."}</p>
              <p><strong>Kullanılan İlan Adedi:</strong> {report.basis?.usedCount || 0} ilan</p>
              <div>
                <strong>Kaynak Siteler / Aramalar:</strong>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {report.basis?.sources && report.basis.sources.length > 0 ? (
                    report.basis.sources.map((src, i) => (
                      <span key={i} className="bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 text-[11px] text-indigo-300">
                        {src}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-500">Google Search & Gemini Piyasa Modeli</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}