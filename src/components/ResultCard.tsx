import type { AnalysisResult, PriceVerdict } from "@/types/analysis";

type Props = { result: AnalysisResult };

const VERDICT_LABELS: Record<PriceVerdict, string> = {
  great_deal: "Fırsat",
  fair: "Makul",
  expensive: "Pahalı",
  unknown: "Belirsiz",
};

const VERDICT_STYLES: Record<PriceVerdict, string> = {
  great_deal: "bg-emerald-100 text-emerald-800",
  fair: "bg-amber-100 text-amber-800",
  expensive: "bg-red-100 text-red-800",
  unknown: "bg-slate-100 text-slate-600",
};

function formatPrice(value: number, currency: string = "TRY"): string {
  const symbol = currency === "TRY" ? "TL" : currency;
  return value.toLocaleString("tr-TR") + " " + symbol;
}

export function ResultCard({ result }: Props) {
  const market = result.marketPrice;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{result.productName}</h2>
          {result.isDemo && <span className="text-xs text-slate-400">Demo</span>}
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-sm font-semibold " + VERDICT_STYLES[result.verdict]
          }
        >
          {VERDICT_LABELS[result.verdict]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <span className="text-xs text-slate-500">Depolama</span>
          <p className="font-semibold text-slate-800">{result.storage ?? "-"}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">İlan fiyatı</span>
          <p className="font-semibold text-slate-800">{formatPrice(result.listingPrice)}</p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Tahmini piyasa</span>
        <p className="font-semibold text-slate-800">
          {market
            ? formatPrice(market.min, market.currency) +
              " - " +
              formatPrice(market.max, market.currency)
            : "Piyasa aralığı bulunamadı"}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Karar</span>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {result.recommendation || "Fiyat değerlendirmesi yapıldı."}
        </p>
      </div>

      {result.updatedAt && (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
          Kaynak: Başlangıç tahmini fiyat tablosu (güncelleme: {result.updatedAt}). Bu aralıklar
          kesin piyasa verisi değil, tahminidir.
        </p>
      )}
    </div>
  );
}

export default ResultCard;