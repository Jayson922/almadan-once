"use client";

// src/components/ReportView.tsx
// Ekspertiz rapor ekranı. Veri yoksa veri uydurmaz; her bölüm EkspertizReport alanlarından beslenir.

import { useState, type ReactNode } from "react";
import type { Decision, Verdict } from "@/lib/valuation";
import type {
  AlternativeListing,
  DeliveryType,
  DeviationBand,
  EkspertizReport,
  EstimateBasis,
  MetricRisk,
  PartAvailability,
  PartEase,
  TechStatus,
} from "@/types/ekspertiz";

interface ReportViewProps {
  report: EkspertizReport;
}

type TabId = "summary" | "technical" | "risk" | "checklist" | "deal" | "basis";
type Tone = "emerald" | "blue" | "amber" | "rose" | "zinc" | "indigo" | "violet";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Genel Özet" },
  { id: "technical", label: "Teknik Rapor" },
  { id: "risk", label: "Risk Analizi" },
  { id: "checklist", label: "Elden Kontrol" },
  { id: "deal", label: "Pazarlık ve Alternatif" },
  { id: "basis", label: "Veri Dayanağı" },
];

const TONE_CLASS: Record<Tone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  blue: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  zinc: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
  indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  violet: "border-violet-500/30 bg-violet-500/15 text-violet-300",
};

const VERDICT_INFO: Record<Verdict, { label: string; tone: Tone }> = {
  great_deal: { label: "Avantajlı fiyat", tone: "emerald" },
  fair: { label: "Adil fiyat", tone: "blue" },
  expensive: { label: "Pahalı", tone: "amber" },
  unknown: { label: "Fiyat değerlendirilemedi", tone: "zinc" },
};

const DECISION_INFO: Record<Decision, { badge: string; tone: Tone; text: string }> = {
  buy: {
    badge: "ALINABİLİR",
    tone: "emerald",
    text: "Fiyat ve ilan işaretleri olumlu. Yine de elden kontrol listesini uygulayın.",
  },
  negotiate: {
    badge: "PAZARLIKLA ALINIR",
    tone: "amber",
    text: "Pazarlık yapmadan ya da koşulları doğrulamadan almayın.",
  },
  avoid: {
    badge: "UZAK DURUN",
    tone: "rose",
    text: "Bu fiyattan ya da bu koşullarla almak önerilmez.",
  },
  unknown: {
    badge: "KARAR VERİLEMEDİ",
    tone: "zinc",
    text: "Canlı piyasa verisi yetersiz. Benzer ilanları elle karşılaştırın.",
  },
};

const BAND_INFO: Record<DeviationBand, { label: string; tone: Tone }> = {
  much_below: { label: "Piyasanın çok altında", tone: "amber" },
  below: { label: "Piyasanın altında", tone: "emerald" },
  near: { label: "Piyasa seviyesinde", tone: "blue" },
  above: { label: "Piyasanın üzerinde", tone: "amber" },
  much_above: { label: "Piyasanın çok üzerinde", tone: "rose" },
};

const STATUS_TONE: Record<TechStatus, Tone> = {
  "doğrulandı": "emerald",
  tahmini: "amber",
  bulunamadı: "zinc",
};

const RISK_TONE: Record<MetricRisk, Tone> = {
  "Düşük": "emerald",
  Orta: "amber",
  "Yüksek": "rose",
  Bilinmiyor: "zinc",
};

const ESTIMATE_BASIS_TONE: Record<EstimateBasis, Tone> = {
  "kullanıcı beyanı": "blue",
  "model bilgisinden tahmin": "amber",
  "doğrulanamadı": "zinc",
};

const EASE_INFO: Record<PartEase, { label: string; tone: Tone }> = {
  kolay: { label: "Kolay", tone: "emerald" },
  orta: { label: "Orta", tone: "amber" },
  zor: { label: "Zor", tone: "rose" },
  bilinmiyor: { label: "Bilinmiyor", tone: "zinc" },
};

const AVAILABILITY_INFO: Record<PartAvailability, { label: string; tone: Tone }> = {
  "yaygın": { label: "Yaygın", tone: "emerald" },
  orta: { label: "Orta", tone: "amber" },
  "sınırlı": { label: "Sınırlı", tone: "rose" },
  bilinmiyor: { label: "Bilinmiyor", tone: "zinc" },
};

const DELIVERY_LABEL: Record<DeliveryType, string> = {
  kargo: "Yalnızca kargo",
  elden: "Elden teslim",
  ikisi: "Kargo veya elden",
};

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

function fmtSigned(pct: number | null): string {
  if (pct === null) return "-";
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${sign}%${Math.abs(pct).toFixed(1).replace(".", ",")}`;
}

function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("tr-TR");
}

// ---------------------------------------------------------------------------
// Küçük bileşenler
// ---------------------------------------------------------------------------

function Glass({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function Banner({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-xl border p-4 text-xs leading-relaxed ${TONE_CLASS[tone]}`}>
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-zinc-200">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">{children}</h3>;
}

function Tile({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1.5 text-lg font-extrabold text-white">{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-zinc-400">{hint}</div> : null}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs text-zinc-400">
      {children}
    </p>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-200"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function DeviationGauge({ pct }: { pct: number }) {
  const clamped = Math.max(-40, Math.min(40, pct));
  const left = ((clamped + 40) / 80) * 100;
  return (
    <div aria-hidden="true">
      <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-rose-500/40">
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/40" style={{ left: "50%" }} />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow"
          style={{ left: `${left}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>-%40 ve altı</span>
        <span>Medyan</span>
        <span>+%40 ve üstü</span>
      </div>
    </div>
  );
}

function AlternativeCard({ alt, best = false }: { alt: AlternativeListing; best?: boolean }) {
  const href = safeHref(alt.url);
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        best ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {best ? <Pill tone="emerald">EN AVANTAJLI EŞDEĞER</Pill> : null}
          <Pill tone="indigo">{alt.source}</Pill>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold text-emerald-300">{fmtMoney(alt.price)}</div>
          <div className="text-[11px] font-semibold text-emerald-400">
            -{fmtMoney(alt.savingsTL)} (%{alt.savingsPct.toFixed(1).replace(".", ",")})
          </div>
        </div>
      </div>

      <h4 className="text-sm font-bold text-white">{alt.title}</h4>

      <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-500">Satıcı güveni</dt>
          <dd className="mt-0.5 font-semibold text-zinc-200">
            {alt.sellerTrust !== null ? `${alt.sellerTrust}/100` : "İlanda belirtilmemiş"}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-500">Teslimat</dt>
          <dd className="mt-0.5 font-semibold text-zinc-200">
            {alt.delivery !== null ? DELIVERY_LABEL[alt.delivery] : "İlanda belirtilmemiş"}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-500">Bağlantı doğrulaması</dt>
          <dd className={`mt-0.5 font-semibold ${alt.urlGrounded ? "text-emerald-300" : "text-amber-300"}`}>
            {alt.urlGrounded ? "Arama sonuçlarında doğrulandı" : "Doğrulanamadı, ilanı kontrol edin"}
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-zinc-300">{alt.reason}</p>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
        >
          <span>İlanı yeni sekmede aç</span>
          <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------

export default function ReportView({ report }: ReportViewProps) {
  const [tab, setTab] = useState<TabId>("summary");
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggleCheck = (index: number) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const b = report.basis;
  const decisionInfo = DECISION_INFO[report.decision];
  const verdictInfo = VERDICT_INFO[report.verdict];
  const noLiveData = report.estimated && !report.marketPriceIsEstimate;
  const dev = report.priceDeviation;
  const bandInfo = dev.band ? BAND_INFO[dev.band] : null;
  const warnSet = new Set(report.warnings);
  const doneCount = report.checklist.filter((_, i) => checked[i]).length;

  const others = report.bestAlternative
    ? report.betterAlternatives.filter((a) => a.url !== report.bestAlternative?.url)
    : report.betterAlternatives;

  const funnel: Array<[string, number]> = [
    ["Gelen ham ilan", b.receivedCount],
    ["Geçersiz fiyat veya veri", b.invalidRemoved],
    ["Aksesuar, arızalı veya sıfır ürün", b.excludedRemoved],
    ["Tekrarlanan ilan", b.duplicatesRemoved],
    ["Eski ilan", b.staleRemoved],
    ["Model veya depolama uyuşmayan", b.mismatchRemoved],
    ["IQR aykırı değer", b.outliersRemoved],
    ["Hesaplamaya katılan ilan", b.usedCount],
  ];

  return (
    <div className="space-y-5">
      {/* Üst kart */}
      <Glass className="space-y-5 p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">{report.category}</div>
            <h2 className="mt-1 text-xl font-extrabold text-white">{report.productName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pill tone={verdictInfo.tone}>{verdictInfo.label}</Pill>
              {report.estimated ? <Pill tone="amber">CANLI VERİ YOK</Pill> : <Pill tone="emerald">CANLI İLANLARLA HESAPLANDI</Pill>}
            </div>
          </div>
          <div className="md:max-w-xs md:text-right">
            <div
              className={`inline-block rounded-full border px-4 py-1.5 text-xs font-bold ${TONE_CLASS[decisionInfo.tone]}`}
            >
              {decisionInfo.badge}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{decisionInfo.text}</p>
          </div>
        </div>

        {noLiveData ? (
          <Banner tone="amber" title="Canlı piyasa verisi yok">
            {b.notes} Bu raporda fiyat kararı verilmedi. Aşağıdaki teknik bölümler yapay zeka değerlendirmesidir.
          </Banner>
        ) : null}
        {report.marketPriceIsEstimate ? (
          <Banner tone="amber" title="Gösterilen piyasa aralığı yapay zeka tahminidir">
            Canlı ilanlarla doğrulanmadı. Kesin bir piyasa referansı olarak kullanmayın.
          </Banner>
        ) : null}
        {report.suspiciouslyLow ? (
          <Banner tone="rose" title="Fiyat şüpheli derecede düşük">
            İlan fiyatı piyasa alt sınırının çok altında. Cihazı elden test etmeden ödeme yapmayın.
          </Banner>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="İstenen fiyat">
            <span className="text-indigo-300">{fmtMoney(report.listingPrice)}</span>
          </Tile>
          <Tile
            label={report.marketPriceIsEstimate ? "Piyasa aralığı (tahmin)" : "Piyasa aralığı"}
            hint={
              report.marketPrice
                ? `Medyan: ${fmtMoney(report.marketPrice.median)}${report.marketPriceIsEstimate ? " (tahmini)" : ""}`
                : "Yeterli canlı ilan bulunamadı"
            }
          >
            {report.marketPrice ? (
              <span className="text-base text-emerald-300">
                {fmtMoney(report.marketPrice.min)} - {fmtMoney(report.marketPrice.max)}
              </span>
            ) : (
              <span className="text-base text-zinc-400">Hesaplanamadı</span>
            )}
          </Tile>
          <Tile
            label="Medyana sapma"
            hint={bandInfo ? bandInfo.label : "Gerçek ilan verisi gerekir"}
          >
            <span className="text-violet-300">{fmtSigned(dev.vsMedianPct)}</span>
          </Tile>
          <Tile
            label="Veri güveni"
            hint={`${b.usedCount} ilan kullanıldı, ${b.groundedSourceCount} kaynak doğrulandı`}
          >
            {report.estimated ? (
              <span className="text-base text-zinc-400">Doğrulanmış güven yok</span>
            ) : (
              <span className="text-violet-300">%{report.confidence}</span>
            )}
          </Tile>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Alıcı için sonuç</div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">{report.recommendation}</p>
        </div>
      </Glass>

      {/* Sekmeler */}
      <div role="tablist" aria-label="Rapor bölümleri" className="flex flex-wrap gap-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-4 py-2 font-semibold transition ${
              tab === t.id
                ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border-white/10 bg-white/[0.04] text-zinc-400 backdrop-blur-xl hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Glass className="min-h-[220px] space-y-5 p-5 md:p-6">
        {/* GENEL ÖZET */}
        {tab === "summary" && (
          <div className="space-y-5">
            <SectionTitle>Ürün durumu ve piyasa özeti</SectionTitle>
            <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
              {report.summary}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {report.identity.brand ? <Pill tone="indigo">{report.identity.brand}</Pill> : null}
              {report.identity.series ? <Pill tone="indigo">{report.identity.series}</Pill> : null}
              {report.identity.releaseYear ? <Pill tone="zinc">{report.identity.releaseYear}</Pill> : null}
              {report.identity.storage ? <Pill tone="zinc">{report.identity.storage}</Pill> : null}
              <Pill tone="blue">Kondisyon: {report.identity.conditionLabel}</Pill>
              {report.identity.hasBox ? <Pill tone="emerald">Kutulu ve faturalı</Pill> : null}
              {report.identity.hasWarranty ? <Pill tone="emerald">Garantili</Pill> : null}
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <SectionTitle>Fiyat sapma matrisi</SectionTitle>
              {dev.vsMedianPct === null ? (
                <EmptyNote>
                  Sapma hesaplanamadı. Matris yalnızca gerçek ilanlardan çıkan piyasa aralığıyla hesaplanır.
                </EmptyNote>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Medyana göre", dev.vsMedianPct],
                        ["Alt sınıra göre", dev.vsMinPct],
                        ["Üst sınıra göre", dev.vsMaxPct],
                      ] as Array<[string, number | null]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="text-zinc-500">{label}</div>
                        <div className="mt-0.5 text-base font-extrabold text-white">{fmtSigned(value)}</div>
                      </div>
                    ))}
                  </div>
                  {bandInfo ? <Pill tone={bandInfo.tone}>{bandInfo.label}</Pill> : null}
                  <DeviationGauge pct={dev.vsMedianPct} />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-400">Öne çıkan avantajlar</span>
                <BulletList items={report.strengths} empty="Bu ilan için doğrulanabilir bir avantaj belirtilmedi." />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-rose-400">Eksik veriler</span>
                <BulletList items={report.missingData} empty="Eksik veri bildirilmedi." />
              </div>
            </div>
          </div>
        )}

        {/* TEKNİK RAPOR */}
        {tab === "technical" && (
          <div className="space-y-5">
            <SectionTitle>Donanım ve teknik değerlendirme</SectionTitle>
            <Banner tone="blue" title="Bu bölüm ölçüm değildir">
              Teknik maddeler modelin genel bilinen özelliklerinden yapay zeka ile üretilmiştir. Cihazınız için
              doğrulanması gerekenleri elden kontrol listesinde bulabilirsiniz.
            </Banner>

            {report.technicalItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {report.technicalItems.map((it, i) => (
                  <div key={`${it.area}-${i}`} className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{it.area}</span>
                      <Pill tone={STATUS_TONE[it.status]}>{it.status}</Pill>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-300">{it.finding}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote>Teknik madde üretilemedi.</EmptyNote>
            )}

            <p className="whitespace-pre-line rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
              {report.technicalComments}
            </p>

            {report.hardwareMetrics.length > 0 || report.repairability ? (
              <div className="space-y-5">
                {report.hardwareMetrics.length > 0 ? (
                  <div className="space-y-3">
                    <SectionTitle>Donanım metrikleri</SectionTitle>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {report.hardwareMetrics.map((m) => (
                        <div key={m.id} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{m.label}</span>
                            <div className="flex gap-1.5">
                              <Pill tone={RISK_TONE[m.risk]}>Risk: {m.risk}</Pill>
                              <Pill tone={ESTIMATE_BASIS_TONE[m.basis]}>{m.basis}</Pill>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-indigo-200">{m.value}</div>
                          <p className="text-[11px] leading-relaxed text-zinc-400">{m.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {report.repairability ? (
                  <div className="space-y-3">
                    <SectionTitle>Tamir edilebilirlik</SectionTitle>
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-2xl font-extrabold text-white">
                          {report.repairability.score !== null ? `${report.repairability.score}/10` : "Belirsiz"}
                        </span>
                        <Pill tone={ESTIMATE_BASIS_TONE[report.repairability.scoreBasis]}>
                          {report.repairability.scoreBasis}
                        </Pill>
                        <Pill tone={AVAILABILITY_INFO[report.repairability.partAvailability].tone}>
                          Yedek parça: {AVAILABILITY_INFO[report.repairability.partAvailability].label}
                        </Pill>
                      </div>
                      {report.repairability.score !== null ? (
                        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
                            style={{ width: `${Math.max(0, Math.min(10, report.repairability.score)) * 10}%` }}
                          />
                        </div>
                      ) : null}
                      <p className="text-xs leading-relaxed text-zinc-300">{report.repairability.summary}</p>
                      {report.repairability.partAvailabilityNote ? (
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          {report.repairability.partAvailabilityNote}
                        </p>
                      ) : null}
                      {report.repairability.modularity.length > 0 ? (
                        <ul className="space-y-1.5">
                          {report.repairability.modularity.map((mod, i) => (
                            <li
                              key={`${mod.part}-${i}`}
                              className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs"
                            >
                              <div>
                                <div className="font-semibold text-zinc-100">{mod.part}</div>
                                <div className="text-[11px] text-zinc-400">{mod.note}</div>
                              </div>
                              <Pill tone={EASE_INFO[mod.ease].tone}>{EASE_INFO[mod.ease].label}</Pill>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyNote>Bu raporda ayrıntılı donanım metriği ve tamir edilebilirlik detayı üretilmedi.</EmptyNote>
            )}

            {report.imageFindings.length > 0 ? (
              <div className="space-y-2">
                <SectionTitle>Görsel bulguları</SectionTitle>
                <BulletList items={report.imageFindings} empty="" />
              </div>
            ) : null}
          </div>
        )}

        {/* RİSK ANALİZİ */}
        {tab === "risk" && (
          <div className="space-y-4">
            <SectionTitle>Potansiyel riskler ve dikkat edilmesi gerekenler</SectionTitle>
            {report.riskAnalysis.length === 0 ? (
              <EmptyNote>Risk maddesi üretilemedi.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {report.riskAnalysis.map((risk, i) => {
                  const isSystem = warnSet.has(risk);
                  return (
                    <li
                      key={`${i}-${risk.slice(0, 24)}`}
                      className={`space-y-1.5 rounded-xl border p-3 text-xs leading-relaxed text-zinc-200 ${
                        isSystem ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-white/10 bg-black/30"
                      }`}
                    >
                      <Pill tone={isSystem ? "rose" : "zinc"}>
                        {isSystem ? "Sistem uyarısı" : "Yapay zeka değerlendirmesi"}
                      </Pill>
                      <p>{risk}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ELDEN KONTROL */}
        {tab === "checklist" && (
          <div className="space-y-4">
            <SectionTitle>Elden teslim alırken kontrol edilecekler</SectionTitle>
            <p className="text-xs text-zinc-400">Cihazı elden teslim alırken maddeleri tek tek kontrol edip işaretleyin.</p>
            {report.checklist.length > 0 ? (
              <>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-zinc-400">
                    <span>İlerleme</span>
                    <span>
                      {doneCount} / {report.checklist.length}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(doneCount / report.checklist.length) * 100}%` }}
                    />
                  </div>
                </div>
                <ul className="space-y-2">
                  {report.checklist.map((item, i) => {
                    const isChecked = !!checked[i];
                    return (
                      <li key={`${i}-${item.slice(0, 24)}`}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => toggleCheck(i)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition ${
                            isChecked
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-black/30 text-zinc-200 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                              isChecked ? "border-emerald-400 bg-emerald-600 text-white" : "border-zinc-600"
                            }`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className={isChecked ? "line-through opacity-80" : ""}>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyNote>Kontrol maddesi üretilemedi.</EmptyNote>
            )}
          </div>
        )}

        {/* PAZARLIK VE ALTERNATİF */}
        {tab === "deal" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <SectionTitle>Pazarlık stratejisi</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Tile
                  label={report.marketPrice ? "Önerilen ilk teklif" : "Varsayılan ilk teklif"}
                  hint={report.marketPrice ? undefined : "Piyasa referansı değil, ilan fiyatından türetildi"}
                >
                  <span className="text-emerald-300">{fmtMoney(report.bargainingPlan.targetOffer)}</span>
                </Tile>
                <Tile label="Vazgeçme fiyatı" hint="Bu tutarı aşarsanız pazarlıktan çekilin">
                  <span className="text-amber-300">{fmtMoney(report.bargainingPlan.walkAwayPrice)}</span>
                </Tile>
              </div>
              <BulletList items={report.bargainingPlan.tactics} empty="Taktik üretilemedi." />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>
                  {report.alternativesStatus === "found"
                    ? `Daha avantajlı ${report.betterAlternatives.length} eşdeğer ilan`
                    : "Avantajlı eşdeğer ilan"}
                </SectionTitle>
                <span className="text-[10px] text-zinc-500">Yalnızca gerçek ve bağlantılı ilanlar</span>
              </div>

              {report.alternativesStatus === "insufficient_data" ? (
                <EmptyNote>
                  Canlı piyasa verisi olmadığı için alternatif ilan aranamadı. Uydurma ilan gösterilmez.
                </EmptyNote>
              ) : null}
              {report.alternativesStatus === "none_found" ? (
                <EmptyNote>
                  Bu fiyatın altında, modeli ve depolaması eşleşen, bağlantısı doğrulanabilen ilan bulunamadı.
                </EmptyNote>
              ) : null}

              {report.bestAlternative ? <AlternativeCard alt={report.bestAlternative} best /> : null}
              {others.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {others.map((alt) => (
                    <AlternativeCard key={alt.url} alt={alt} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* VERİ DAYANAĞI */}
        {tab === "basis" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Şeffaf veri dayanağı</SectionTitle>
              <div className="flex gap-1.5">
                <Pill tone={b.mode === "live" ? "emerald" : "amber"}>
                  {b.mode === "live" ? "Canlı ilan verisi" : "Tahmin modu"}
                </Pill>
                {b.fromCache ? <Pill tone="zinc">Önbellekten</Pill> : null}
              </div>
            </div>

            <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-zinc-200">
              {b.notes || "Analiz notu üretilmedi."}
            </p>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">İlan süzme hunisi</span>
              <ul className="overflow-hidden rounded-xl border border-white/10">
                {funnel.map(([label, count], i) => (
                  <li
                    key={label}
                    className={`flex items-center justify-between px-4 py-2 text-xs ${
                      i % 2 === 0 ? "bg-black/30" : "bg-black/10"
                    } ${i === funnel.length - 1 ? "font-bold text-indigo-200" : "text-zinc-300"}`}
                  >
                    <span>{label}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-500">Eşleşen ilan sayısı süzgeç sonrası: {b.matchedCount}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">IQR (çeyrekler açıklığı) süzgeci</span>
              {b.iqr ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Q1 (alt çeyrek)", fmtMoney(b.iqr.q1)],
                        ["Q3 (üst çeyrek)", fmtMoney(b.iqr.q3)],
                        ["IQR", fmtMoney(b.iqr.iqr)],
                        ["Alt sınır", fmtMoney(b.iqr.lowerFence)],
                        ["Üst sınır", fmtMoney(b.iqr.upperFence)],
                        ["Çarpan", `x${String(b.iqr.multiplier).replace(".", ",")}`],
                      ] as Array<[string, string]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                        <div className="text-zinc-500">{label}</div>
                        <div className="mt-0.5 font-bold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-300">
                    Süzgeç öncesi {b.iqr.beforeCount} ilan, sonrası {b.iqr.afterCount} ilan.{" "}
                    {b.iqr.applied
                      ? b.iqr.removed.length === 0
                        ? "Sınırların dışında ilan çıkmadı."
                        : "Sınırların dışındaki ilanlar elendi."
                      : "Eleme sonrası yeterli ilan kalmayacağı için aykırı değer elemesi uygulanmadı."}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Süzgeç, kondisyona göre düzeltilmiş fiyatlar üzerinde çalışır.
                  </p>
                  {b.iqr.removed.length > 0 ? (
                    <ul className="space-y-1.5">
                      {b.iqr.removed.map((r, i) => (
                        <li
                          key={`${r.title}-${i}`}
                          className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-zinc-100">{r.title}</div>
                            <div className="text-[11px] text-zinc-400">
                              {r.source} - {r.side === "low" ? "Alt sınırın altında" : "Üst sınırın üstünde"}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-zinc-300">
                            <div>{fmtMoney(r.price)}</div>
                            <div className="text-zinc-500">Düzeltilmiş: {fmtMoney(r.adjustedPrice)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <EmptyNote>IQR süzgeci için en az 5 eşleşen ilan gerekir; bu raporda uygulanmadı.</EmptyNote>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">Taranan pazar havuzu (süzgeçten önce)</span>
              {b.platforms.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {b.platforms.map((p) => (
                    <li
                      key={p.name}
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200"
                    >
                      {p.name}: <span className="font-bold text-indigo-300">{p.receivedCount} ilan</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyNote>Hiçbir platformdan ilan alınamadı. Yalnızca gerçekten ilan gelen platformlar gösterilir.</EmptyNote>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">Kaynaklar</span>
              {b.sources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {b.sources.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-indigo-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyNote>Kaynak bulunamadı.</EmptyNote>
              )}
              {b.sourceLinks.length > 0 ? (
                <ul className="space-y-1">
                  {b.sourceLinks.map((l, i) => {
                    const href = safeHref(l.uri);
                    return (
                      <li key={`${l.uri}-${i}`} className="truncate text-[11px] text-zinc-400">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-300 underline-offset-2 hover:underline"
                          >
                            {l.title}
                          </a>
                        ) : (
                          l.title
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">
                {b.mode === "live" ? "Hesaplamaya giren ilanlar" : "Eşleşen ama yetersiz kalan ilanlar"}
              </span>
              {b.usedComps.length > 0 ? (
                <ul className="space-y-1.5">
                  {b.usedComps.map((c, i) => {
                    const href = safeHref(c.url);
                    return (
                      <li
                        key={`${c.title}-${i}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-100">{c.title}</div>
                          <div className="text-[11px] text-zinc-500">{c.source}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-emerald-300">{fmtMoney(c.price)}</div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-indigo-300 hover:underline"
                            >
                              Aç
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyNote>Listelenecek ilan yok.</EmptyNote>
              )}
            </div>
          </div>
        )}
      </Glass>

      <p className="px-1 text-center text-[11px] text-zinc-500">
        {report.disclaimer}
        {fmtDate(report.generatedAt) ? ` Rapor zamanı: ${fmtDate(report.generatedAt)}.` : ""}
      </p>
    </div>
  );
}