import type { AnalysisResult } from "@/types/analysis";

function formatPrice(value: any): string {
  if (typeof value === "number" && !isNaN(value)) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }
  if (value && typeof value === "object") {
    if (typeof value.min === "number" && typeof value.max === "number") {
      return `${value.min.toLocaleString("tr-TR")} TL - ${value.max.toLocaleString("tr-TR")} TL`;
    }
  }
  return "0 TL";
}

function renderVerdict(verdict: any): string {
  if (!verdict) return "BELİRSİZ";
  if (typeof verdict === "string") {
    const labels: Record<string, string> = {
      ÇOK_PAHALI: "ÇOK PAHALI",
      PAHALI: "PAHALI",
      UYGUN: "UYGUN",
      ÇOK_UYGUN: "ÇOK UYGUN",
      expensive: "PAHALI",
      reasonable: "UYGUN",
      cheap: "ÇOK UYGUN",
    };
    return labels[verdict] ?? verdict;
  }
  if (typeof verdict === "object" && verdict.label) {
    return String(verdict.label);
  }
  return String(verdict);
}

export default function ResultCard({ result }: { result: AnalysisResult }) {
  const verdictText = renderVerdict(result.verdict);

  const verdictColors: Record<string, string> = {
    "ÇOK PAHALI": "bg-red-100 text-red-800 border-red-200",
    PAHALI: "bg-orange-100 text-orange-800 border-orange-200",
    UYGUN: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "ÇOK UYGUN": "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Ürün
        </span>
        <h2 className="text-xl font-bold text-slate-900">{result.phoneName}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <span className="text-xs text-slate-500">Depolama</span>
          <p className="font-semibold text-slate-800">{result.storage}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">İlan fiyatı</span>
          <p className="font-semibold text-slate-800">
            {formatPrice(result.price)}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Tahmini piyasa</span>
        <p className="font-semibold text-slate-800">
          {formatPrice(result.minPrice)} - {formatPrice(result.maxPrice)}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Fiyat değerlendirmesi</span>
        <div className="mt-1">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${
              verdictColors[verdictText] ?? "bg-slate-100 text-slate-800 border-slate-200"
            }`}
          >
            {verdictText}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Karar</span>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {typeof result.recommendation === "string"
            ? result.recommendation
            : "Fiyat değerlendirmesi yapıldı."}
        </p>
      </div>

      {result.updatedAt && (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
          Kaynak: Başlangıç tahmini fiyat tablosu (güncelleme: {result.updatedAt}). Bu aralıklar kesin piyasa verisi değil, tahminidir.
        </p>
      )}
    </div>
  );
}