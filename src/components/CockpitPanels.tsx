// src/components/CockpitPanels.tsx
// Sağ taraftaki teşhis paneli: donanım haritası + hazırlık skoru göstergesi.
// Ek bağımlılık yok. Yalnızca page.tsx içindeki mevcut form verisini görselleştirir.

type Tone = "ok" | "warn" | "none";

const TONE: Record<Tone, { box: string; text: string; dot: string }> = {
  ok: { box: "border-emerald-400/50", text: "text-emerald-300", dot: "bg-emerald-400" },
  warn: { box: "border-rose-400/50", text: "text-rose-300", dot: "bg-rose-400" },
  none: { box: "border-white/10", text: "text-white/45", dot: "bg-white/30" },
};

interface Spot {
  key: string;
  label: string;
  status: string;
  tone: Tone;
  box: string; // etiketin konumu
  dot: string; // telefon üzerindeki nokta konumu
}

export function DiagnosticMap({
  scanning,
  battery,
  tags,
  photos,
}: {
  scanning: boolean;
  battery: number | null;
  tags: string[];
  photos: number;
}) {
  const has = (t: string) => tags.includes(t);
  const scratched = has("Çizikler Var") || has("Ufak Çizikler Var");

  const spots: Spot[] = [
    {
      key: "camera",
      label: "Kamera",
      status: photos > 0 ? `${photos} görsel` : "Görsel yok",
      tone: photos > 0 ? "ok" : "none",
      box: "left-0 top-[8%]",
      dot: "left-[30%] top-[10%]",
    },
    {
      key: "screen",
      label: "Ekran",
      status: scratched ? "Çizik bildirildi" : has("Face ID / True Tone Aktif") ? "Face ID aktif" : "Bilgi yok",
      tone: scratched ? "warn" : has("Face ID / True Tone Aktif") ? "ok" : "none",
      box: "right-0 top-[8%]",
      dot: "left-[66%] top-[24%]",
    },
    {
      key: "body",
      label: "Kasa",
      status: scratched ? "Çizik bildirildi" : has("Değişensiz / Orijinal") ? "Orijinal" : "Bilgi yok",
      tone: scratched ? "warn" : has("Değişensiz / Orijinal") ? "ok" : "none",
      box: "left-0 top-[44%]",
      dot: "left-[28%] top-[50%]",
    },
    {
      key: "battery",
      label: "Pil",
      status: has("Pil Değişmiş") ? "Değişmiş" : battery === null ? "Bilgi yok" : `%${battery}`,
      tone: has("Pil Değişmiş") ? "warn" : battery === null ? "none" : battery >= 85 ? "ok" : "warn",
      box: "right-0 top-[58%]",
      dot: "left-[62%] top-[66%]",
    },
  ];

  return (
    <div>
      <div className="relative mx-auto h-[270px] w-full" aria-hidden="true">
        <div
          className="absolute left-1/2 top-1/2 h-[230px] w-[112px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] border border-amber-300/50 bg-gradient-to-b from-amber-300/10 to-transparent shadow-[0_0_40px_-8px_rgba(245,158,11,.45)]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245,158,11,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.08) 1px,transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/15" />
          {scanning && <div className="ao-scanline" />}
          {spots.map((s) => (
            <span
              key={s.key}
              className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white/10 ${TONE[s.tone].dot} ${s.dot}`}
            />
          ))}
        </div>
        {spots.map((s) => (
          <div
            key={s.key}
            className={`absolute w-[92px] rounded-lg border bg-[var(--field)] px-2 py-1 ${TONE[s.tone].box} ${s.box}`}
          >
            <p className="text-[11px] font-semibold text-white/85">{s.label}</p>
            <p className={`truncate text-[11px] ${TONE[s.tone].text}`}>{s.status}</p>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {spots.map((s) => (
          <li key={s.key}>
            {s.label}: {s.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreGauge({ score, label }: { score: number; label: string }) {
  const arc = Math.PI * 80; // yarım dairenin uzunluğu
  const angle = -90 + (score / 100) * 180;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[250px]" role="img" aria-label={`Analiz kalitesi yüzde ${score}, ${label}`}>
        <defs>
          <linearGradient id="ao-gauge-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#FDE68A" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#ao-gauge-grad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - score / 100)}
          className="ao-anim"
          style={{ transition: "stroke-dashoffset .6s ease", filter: "drop-shadow(0 0 6px rgba(245,158,11,.6))" }}
        />
        <g
          className="ao-anim"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px", transition: "transform .6s cubic-bezier(.3,1.3,.5,1)" }}
        >
          <line x1="100" y1="100" x2="100" y2="36" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#FBBF24" />
      </svg>
      <p className="-mt-1 text-sm text-white/60">
        Analiz kalitesi: <span className="font-bold tabular-nums text-amber-300">%{score}</span> {label}
      </p>
    </div>
  );
}

export function CockpitAside({
  scanning,
  battery,
  tags,
  photos,
  score,
  label,
  tips,
}: {
  scanning: boolean;
  battery: number | null;
  tags: string[];
  photos: number;
  score: number;
  label: string;
  tips: string[];
}) {
  return (
    <aside aria-label="Cihaz teşhis özeti" className="hidden space-y-5 lg:sticky lg:top-20 lg:block">
      <section className="ao-card p-5">
        <h2 className="ao-display text-base font-bold text-amber-200">Donanım haritası</h2>
        <p className="mb-3 text-xs text-white/45">Girdiğin bilgiler cihaz üzerinde canlı işaretlenir.</p>
        <DiagnosticMap scanning={scanning} battery={battery} tags={tags} photos={photos} />
      </section>
      <section className="ao-card p-5 text-center">
        <h2 className="ao-display mb-2 text-base font-bold text-amber-200">Ekspertiz hazırlık skoru</h2>
        <ScoreGauge score={score} label={label} />
        {tips.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-white/50">Daha isabetli rapor için: {tips.join(", ").toLowerCase()}.</p>
        )}
      </section>
    </aside>
  );
}