"use client";

import React, { useState } from "react";

export default function ExpertAdvisorCard({ result, data }: any) {
  const item = result || data || {};
  const phoneName = item.phoneName || "Cihaz";
  const listPrice = Number(item.price) || 25000;
  const targetOffer = Math.round(listPrice * 0.88);

  const [scenario, setScenario] = useState<"quick" | "battery" | "cash">("quick");
  const [copied, setCopied] = useState(false);

  // Pazarlık Senaryoları Metinleri
  const messages = {
    quick: `Merhaba, ${phoneName} ilanınız için yazıyorum. İkinci el piyasa ortalamalarını ve bugünkü alım durumumu göz önüne alarak ${targetOffer} TL teklif ediyorum. Anlaşırsak bugün içinde konumunuzdan gelip nakit/havale ile teslim alabilirim.`,
    battery: `Merhaba, ${phoneName} cihazınızın genel durumunu inceledim. Olası pil/servis masraflarını ve yaşını hesaba katarak son teklifim ${targetOffer} TL'dir. Uygunsa detayları görüşelim.`,
    cash: `Merhaba, cihazınız temiz görünüyor. Hemen ödeme yapmaya hazırım. Fiyatta son olarak ${targetOffer} TL'ye el sıkışabilirsek işlemi bugün tamamlayalım.`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messages[scenario]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`*Almadan Önce Ekspertiz Özeti*\nCihaz: ${phoneName}\nİlan Fiyatı: ${listPrice} TL\nÖnerilen Teklif: ${targetOffer} TL\nPazarlık Mesajı: ${messages[scenario]}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Başlık */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            🧠 Gelişmiş Pazarlık Danışmanı & Doğrulama
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Satıcının durumuna göre en etkili teklif mesajını seçin ve doğrulamaları yapın.
          </p>
        </div>
      </div>

      {/* Pazarlık Modu Seçimi */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Pazarlık Stratejisi Seçin
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setScenario("quick")}
            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
              scenario === "quick"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            🚀 Hızlı Alım / Bugün
          </button>
          <button
            onClick={() => setScenario("battery")}
            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
              scenario === "battery"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            🔋 Pil/Servis İndirimi
          </button>
          <button
            onClick={() => setScenario("cash")}
            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
              scenario === "cash"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            💵 Sıcak Nakit Teklifi
          </button>
        </div>

        {/* Mesaj Kutusu ve Aksiyonlar */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <p className="text-sm text-slate-800 font-mono leading-relaxed">
            "{messages[scenario]}"
          </p>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/60">
            <button
              onClick={handleCopy}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <span>{copied ? "✅ Kopyalandı!" : "📋 Mesajı Kopyala"}</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <span>💬 WhatsApp'ta Paylaş</span>
            </button>
          </div>
        </div>
      </div>

      {/* BTK IMEI & Güvenlik Kiti */}
      <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h4 className="text-sm font-bold text-amber-900">BTK & e-Devlet Canlı Doğrulama</h4>
          </div>
          <a
            href="https://www.turkiye.gov.tr/imei-sorgulama"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 px-3 rounded-lg transition"
          >
            e-Devlet IMEI Sorgula ↗
          </a>
        </div>
        <p className="text-xs text-amber-800/90 leading-normal">
          Satıcıdan <strong>*#06#</strong> tuşlaması ile çıkan IMEI numarasını isteyin. Cihazın kopyalanmış veya kayıt dışı olmadığından emin olun.
        </p>
      </div>
    </div>
  );
}