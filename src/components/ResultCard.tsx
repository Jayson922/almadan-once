import type { AnalysisResult, PriceVerdict } from "@/types/analysis";

const VERDICT_LABELS: Record<PriceVerdict, string> = {
  great_deal: "ÇOK UYGUN",
  fair: "UYGUN",
  expensive: "PAHALI",
  unknown: "BELİRSİZ",
};

const VERDICT_STYLES: Record<PriceVerdict, string> = {
  great_deal: "bg-emerald-100 text-emerald-800",
  fair: "bg-green-100 text-green-800",
  expensive: "bg-red-100 text-red-800",
  unknown: "bg-slate-100 text-slate-700",
};

function formatPrice(value: number): string {
  return `${value.toLocaleString("tr-TR")} TL`;
}

export default function ResultCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      {result.isDemo && (
        <div
          role="note"
          className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>DEMO sonuç.</strong> Bu sonuç gerçek bir analizden gelmiyor,
          gerçek piyasa verisi kullanılmadı.
        </div>
      )}

      <dl className="space-y-4">
        <div>
          <dt className="text-sm text-slate-500">Ürün</dt>
          <dd className="text-lg font-semibold">{result.productName}</dd>
        </div>
        {result.storage && (
          <div>
            <dt className="text-sm text-slate-500">Depolama</dt>
            <dd className="font-medium">{result.storage}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-slate-500">İlan fiyatı</dt>
          <dd className="font-medium">{formatPrice(result.listingPrice)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Tahmini piyasa</dt>
          <dd className="font-medium">
            {formatPrice(result.marketPrice.min)} -{" "}
            {formatPrice(result.marketPrice.max)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Fiyat değerlendirmesi</dt>
          <dd>
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_STYLES[result.verdict]}`}
            >
              {VERDICT_LABELS[result.verdict]}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Karar</dt>
          <dd className="font-medium">{result.recommendation}</dd>
        </div>
      </dl>
    </div>
  );
}