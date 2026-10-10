"use client";

import { useState } from "react";
import { getChecklistForModel, type CheckItem } from "@/lib/checklists";

interface Props {
  phoneName?: string;
  listPrice?: number;
}

export default function ChecklistCard({ phoneName = "Apple iPhone", listPrice = 0 }: Props) {
  const items = getChecklistForModel(phoneName);
  const [failedItems, setFailedItems] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const toggleItem = (id: string) => {
    setFailedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Kusurlara göre tahmini değer kaybı hesaplama
  const totalImpactPercent = items.reduce((acc, item) => {
    return failedItems[item.id] ? acc + item.impactPercent : acc;
  }, 0);

  const estimatedDeduction = Math.round((listPrice * totalImpactPercent) / 100);
  const suggestedOffer = Math.max(0, listPrice - estimatedDeduction);

  const generateBargainMessage = () => {
    const flaws = items
      .filter((item) => failedItems[item.id])
      .map((item) => item.title)
      .join(", ");

    if (!flaws) {
      return `Merhaba, ${phoneName} ilanınızla ilgileniyorum. Fiyatta son bir pazarlık payınız var mıdır?`;
    }

    return `Merhaba, ${phoneName} cihazınızla ilgileniyorum. Belirttiğiniz/tespit ettiğim (${flaws}) durumlarını göz önüne alarak teklifim ${suggestedOffer.toLocaleString("tr-TR")} TL'dir. Uygunsa bugün gelip alabilirim.`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateBargainMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900">
          🔍 {phoneName} İçin Özel Kontrol Listesi
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Cihazı incelerken sorunlu gördüğünüz maddeleri işaretleyin. Sistem otomatik ideal pazarlık teklifini hesaplayacaktır.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const isFailed = !!failedItems[item.id];
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                isFailed
                  ? "border-red-300 bg-red-50/50"
                  : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">
                      {item.title}
                    </span>
                    {item.critical && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        KRİTİK
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={isFailed}
                  onChange={() => {}}
                  className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
              </div>
            </div>
          );
        })}
      </div>

      {totalImpactPercent > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-amber-900 font-medium">Tespit Edilen Kusur Değer Kaybı:</span>
            <span className="font-bold text-amber-900">-%{totalImpactPercent} (~{estimatedDeduction.toLocaleString("tr-TR")} TL)</span>
          </div>
          <div className="flex justify-between items-center text-base pt-2 border-t border-amber-200/60">
            <span className="font-bold text-slate-900">Önerilen İdeal Teklif:</span>
            <span className="font-extrabold text-emerald-600 text-lg">{suggestedOffer.toLocaleString("tr-TR")} TL</span>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <label className="text-xs font-semibold text-slate-700 block mb-2">
          🤖 Otomatik Hazır Pazarlık Mesajı
        </label>
        <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono">
          {generateBargainMessage()}
        </div>
        <button
          onClick={copyToClipboard}
          className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-all hover:bg-slate-800"
        >
          {copied ? "✓ Kopyalandı!" : "Satıcıya Göndermek İçin Mesajı Kopyala"}
        </button>
      </div>
    </div>
  );
}