'use client';

import Script from 'next/script';
import { useEffect, useId, useMemo, useState } from 'react';
import s from './KimlikMotoru.module.css';

/* ---------- Tipler ---------- */
export type KimlikFormu = {
  marka: string;
  model: string;
  depolama: string | null;
  ram: string | null;
};

export type KimlikSonucu = {
  eslesme: boolean;
  guven: number;
  durum: 'net' | 'kismi' | 'belirsiz' | 'eslesme_yok' | 'bos';
  marka?: string;
  model?: string;
  yil?: number;
  depolamaGB?: number | null;
  ramGB?: number | null;
  yongaSeti?: string;
  bolge?: string | null;
  bolgeAdi?: string | null;
  sim?: string | null;
  ekranInc?: number;
  ekranTipi?: string;
  kimlik?: string;
  form?: KimlikFormu;
  secenekler?: { depolama: string[]; ram: string[] };
  belirsizlikler?: { soru: string; secenekler: string[] }[];
  uyarilar?: { seviye: 'bad' | 'warn' | 'info'; mesaj: string }[];
  adaylar?: { model: string; skor: number }[];
  sinyaller?: string[];
  oneriler?: string[];
};

declare global {
  interface Window {
    KimlikMotoru?: { identify: (girdi: string) => KimlikSonucu };
  }
}

type Props = {
  /** Kutunun başlangıç metni */
  defaultValue?: string;
  /** "Forma aktar" düğmesine basılınca çağrılır. Verilmezse düğme görünmez. */
  onApply?: (form: KimlikFormu) => void;
};

/* ---------- Yardımcılar ---------- */
const ORNEKLER = [
  'iphone 13 128 tr',
  'iPhone 13 128 GB Mavi Pil %92 25.000 TL',
  'SM-S921U 256',
  'iphne 14 pro max 256 LL/A',
  's24 ultra 128gb',
  'redmi note 13',
];

const BOLGE_TOKEN: Record<string, string> = {
  'Türkiye': 'tr',
  'Avrupa / UK': 'eu',
  'ABD': 'us',
  'Çin': 'cn',
  'Güney Kore': 'kr',
  'Japonya': 'jp',
  'Global / uluslararası': 'global',
};
const KOD_TOKEN: Record<string, string> = {
  TR: 'tr', EU: 'eu', US: 'us', CN: 'cn', KR: 'kr', JP: 'jp', GL: 'global',
};

const gb = (n: number) => (n >= 1024 ? `${n / 1024}TB` : `${n}GB`);

type Yama = { model?: string; depolama?: string; ram?: string; bolge?: string };

/** Düğme etiketinden, kutu metnine eklenecek parçayı üretir. */
function yamaUret(soru: string, etiket: string): Yama {
  if (soru.startsWith('Depolama')) return { depolama: etiket };
  if (soru.startsWith('RAM')) return { ram: `${etiket.replace(/\s/g, '')} RAM` };
  if (BOLGE_TOKEN[etiket]) return { bolge: BOLGE_TOKEN[etiket] };
  return { model: etiket };
}

/** Mevcut sonuca yamayı ekleyip yeni kutu metnini üretir. */
function yenidenYaz(r: KimlikSonucu, y: Yama): string {
  const ramCok = (r.secenekler?.ram.length ?? 0) > 1;
  return [
    y.model ?? r.model ?? '',
    y.ram ?? (ramCok && r.ramGB ? `${r.ramGB}GB RAM` : ''),
    y.depolama ?? (r.depolamaGB ? gb(r.depolamaGB) : ''),
    y.bolge ?? (r.bolge ? KOD_TOKEN[r.bolge] ?? '' : ''),
  ]
    .filter(Boolean)
    .join(' ');
}

type Durum = 'kesin' | 'cikarim' | 'eksik' | 'celiski';
const DURUM_YAZI: Record<Durum, string> = {
  kesin: 'kesin',
  cikarim: 'çıkarım',
  eksik: 'eksik',
  celiski: 'çelişki',
};
type Alan = { ad: string; deger: string; durum: Durum; tam?: boolean };

function alanlariCikar(r: KimlikSonucu): Alan[] {
  const dep = r.secenekler?.depolama ?? [];
  const ram = r.secenekler?.ram ?? [];
  const alanlar: Alan[] = [
    { ad: 'Marka', deger: r.marka ?? '', durum: 'kesin' },
    { ad: 'Model', deger: r.model ?? '', durum: 'kesin' },
    { ad: 'Çıkış yılı', deger: String(r.yil ?? ''), durum: 'kesin' },
    r.depolamaGB
      ? { ad: 'Depolama', deger: gb(r.depolamaGB), durum: dep.includes(gb(r.depolamaGB)) ? 'kesin' : 'celiski' }
      : { ad: 'Depolama', deger: `Seçenekler: ${dep.join(', ')}`, durum: 'eksik' },
    r.ramGB
      ? {
          ad: 'RAM',
          deger: `${r.ramGB} GB`,
          durum: !ram.includes(`${r.ramGB}GB`) ? 'celiski' : ram.length === 1 ? 'cikarim' : 'kesin',
        }
      : { ad: 'RAM', deger: `Seçenekler: ${ram.join(', ')}`, durum: 'eksik' },
    {
      ad: 'Yonga seti',
      deger: r.yongaSeti ?? '',
      durum: (r.yongaSeti ?? '').includes(' / ') ? 'eksik' : 'kesin',
    },
    r.bolgeAdi
      ? { ad: 'Bölge / varyant', deger: r.bolgeAdi, durum: 'kesin' }
      : { ad: 'Bölge / varyant', deger: 'Belirtilmedi', durum: 'eksik' },
  ];
  if (r.sim) {
    alanlar.push({ ad: 'SIM yapısı', deger: r.sim, durum: r.sim.startsWith('Bölgeye') ? 'eksik' : 'cikarim' });
  }
  alanlar.push({ ad: 'Ekran', deger: `${r.ekranInc}" ${r.ekranTipi}`, durum: 'kesin' });
  alanlar.push({
    ad: 'Kimlik anahtarı',
    deger: r.kimlik ?? '',
    durum: (r.kimlik ?? '').includes('?') ? 'eksik' : 'kesin',
    tam: true,
  });
  return alanlar;
}

const DURUM_BASLIK: Record<string, string> = {
  net: 'Kimlik net',
  kismi: 'Kısmi kimlik, eksik bilgi var',
  belirsiz: 'Belirsiz kimlik',
};
const CEVRE = 2 * Math.PI * 34;

/* ---------- Bileşen ---------- */
export default function KimlikMotoru({ defaultValue = '', onApply }: Props) {
  const girisId = useId();
  const [girdi, setGirdi] = useState(defaultValue);
  const [hazir, setHazir] = useState(false);
  const [yuklemeHatasi, setYuklemeHatasi] = useState(false);
  const [kopya, setKopya] = useState<'' | 'tamam' | 'hata'>('');

  useEffect(() => {
    if (window.KimlikMotoru) setHazir(true);
  }, []);

  const { sonuc, motorHatasi } = useMemo(() => {
    if (!hazir || !window.KimlikMotoru) return { sonuc: null, motorHatasi: false };
    try {
      return { sonuc: window.KimlikMotoru.identify(girdi), motorHatasi: false };
    } catch {
      return { sonuc: null, motorHatasi: true };
    }
  }, [hazir, girdi]);

  async function kopyala(metin: string) {
    try {
      await navigator.clipboard.writeText(metin);
      setKopya('tamam');
    } catch {
      setKopya('hata');
    }
    setTimeout(() => setKopya(''), 2200);
  }

  const bos = girdi.trim() === '';
  const alanlar = sonuc?.eslesme ? alanlariCikar(sonuc) : [];

  return (
    <section className={s.kok} aria-label="Ürün kimliği motoru">
      <Script
        src="/kimlik-motoru.js"
        strategy="afterInteractive"
        onReady={() => setHazir(Boolean(window.KimlikMotoru))}
        onError={() => setYuklemeHatasi(true)}
      />

      <div className={s.tarama}>
        <label htmlFor={girisId} className={s.etiket}>
          İlan başlığı, model adı ya da model kodu
        </label>
        <input
          id={girisId}
          className={s.giris}
          value={girdi}
          onChange={(e) => setGirdi(e.target.value)}
          placeholder="Örn: iPhone 13 128GB TR  ·  SM-S918B 256  ·  s22 ultra 8/256"
          autoComplete="off"
          spellCheck={false}
        />
        <p className={s.ipucu}>Denemek için dokun:</p>
        <div className={s.satir}>
          {ORNEKLER.map((o) => (
            <button key={o} type="button" className={s.chip} onClick={() => setGirdi(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        {yuklemeHatasi && (
          <div className={`${s.kart} ${s.hataKutu}`}>
            <strong>Motor dosyası yüklenemedi.</strong>
            <p>
              <code>public/kimlik-motoru.js</code> dosyasının var olduğunu kontrol et ve tarayıcıda{' '}
              <code>/kimlik-motoru.js</code> adresinin açıldığını doğrula.
            </p>
          </div>
        )}
        {!yuklemeHatasi && !hazir && <p className={s.ipucu}>Motor yükleniyor…</p>}
        {motorHatasi && <p className={s.ipucu}>Bu metin işlenirken bir sorun oldu. Metni değiştirip tekrar dene.</p>}
        {hazir && bos && <p className={s.ipucu}>Sonuç burada görünecek. Yukarıya ilan başlığını yazabilir ya da yapıştırabilirsin.</p>}

        {sonuc && !bos && !sonuc.eslesme && (
          <div className={s.kart}>
            <div className={`${s.durumYazi} ${s.celiski}`}>Eşleşme yok</div>
            <h2 className={s.baslik}>Bu cihazı tanıyamadım</h2>
            <p className={s.ipucu}>
              Marka ve model adını yaz (örn. &quot;iPhone 14 Pro&quot;) ya da model kodunu ekle (örn. SM-S918B).
              Katalogdaki modeller dışında tahmin yürütmüyorum.
            </p>
            {!!sonuc.oneriler?.length && (
              <div className={s.satir}>
                {sonuc.oneriler.map((o) => (
                  <button key={o} type="button" className={s.chip} onClick={() => setGirdi(o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {sonuc?.eslesme && !bos && (
          <>
            <div className={s.kart}>
              <div className={s.ust}>
                <div>
                  <div className={`${s.durumYazi} ${s[sonuc.durum]}`}>{DURUM_BASLIK[sonuc.durum]}</div>
                  <h2 className={s.baslik}>{sonuc.model}</h2>
                </div>
                <div className={`${s.halka} ${s[sonuc.durum]}`} role="img" aria-label={`Güven skoru yüzde ${sonuc.guven}`}>
                  <svg viewBox="0 0 80 80" width="84" height="84" aria-hidden="true">
                    <circle cx="40" cy="40" r="34" className={s.halkaYol} />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      className={s.halkaDolgu}
                      strokeDasharray={`${(sonuc.guven / 100) * CEVRE} ${CEVRE}`}
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <span className={s.halkaSayi}>%{sonuc.guven}</span>
                </div>
              </div>
              {!!sonuc.sinyaller?.length && (
                <div className={s.satir}>
                  {sonuc.sinyaller.map((x) => (
                    <span key={x} className={s.sinyal}>{x}</span>
                  ))}
                </div>
              )}
              {onApply && sonuc.form && (
                <div className={s.aksiyon}>
                  <button type="button" className={s.buton} onClick={() => sonuc.form && onApply(sonuc.form)}>
                    Bilgileri forma aktar
                  </button>
                  {sonuc.durum !== 'net' && <span className={s.ipucu}>Eksik bilgi var, yine de aktarabilirsin.</span>}
                </div>
              )}
            </div>

            {!!sonuc.belirsizlikler?.length && (
              <div className={s.kart}>
                <h3 className={s.altBaslik}>Kimliği netleştirmek için</h3>
                {sonuc.belirsizlikler.map((b) => (
                  <div key={b.soru} className={s.soru}>
                    <p>{b.soru}</p>
                    <div className={s.satir}>
                      {b.secenekler.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className={s.chip}
                          onClick={() => setGirdi(yenidenYaz(sonuc, yamaUret(b.soru, e)))}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={s.kart}>
              <h3 className={s.altBaslik}>Çözülen kimlik</h3>
              <div className={s.izgara}>
                {alanlar.map((a) => (
                  <div key={a.ad} className={`${s.alan} ${a.tam ? s.tam : ''}`}>
                    <div className={s.alanUst}>
                      <span>{a.ad}</span>
                      <em className={s[a.durum]}>{DURUM_YAZI[a.durum]}</em>
                    </div>
                    <b className={s.alanDeger}>{a.tam ? <code>{a.deger}</code> : a.deger}</b>
                  </div>
                ))}
              </div>
            </div>

            {!!sonuc.uyarilar?.length && (
              <div className={s.kart}>
                <h3 className={s.altBaslik}>Doğrulama bulguları</h3>
                {sonuc.uyarilar.map((u) => (
                  <div key={u.mesaj} className={`${s.uyari} ${s[u.seviye]}`}>{u.mesaj}</div>
                ))}
              </div>
            )}

            {(sonuc.adaylar?.length ?? 0) > 1 && (
              <div className={s.kart}>
                <h3 className={s.altBaslik}>Karıştırılabilecek yakın modeller</h3>
                <div className={s.satir}>
                  {sonuc.adaylar!
                    .filter((a) => a.model !== sonuc.model)
                    .map((a) => (
                      <button
                        key={a.model}
                        type="button"
                        className={s.chip}
                        onClick={() => setGirdi(yenidenYaz(sonuc, { model: a.model }))}
                      >
                        {a.model} · %{a.skor}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <details className={s.json}>
              <summary>Fiyat motoruna giden JSON çıktısı</summary>
              <pre>{JSON.stringify(sonuc, null, 2)}</pre>
              <button type="button" className={s.chip} onClick={() => kopyala(JSON.stringify(sonuc, null, 2))}>
                {kopya === 'tamam' ? 'Kopyalandı' : kopya === 'hata' ? 'Kopyalanamadı, metni elle seç' : "JSON'u kopyala"}
              </button>
            </details>
          </>
        )}
      </div>

      <Rehber />
    </section>
  );
}

/* ---------- Rehber: kullanıcının öğreneceği her şey ---------- */
function Rehber() {
  return (
    <div className={s.kart}>
      <h3 className={s.altBaslik}>Rehber: sonuçları nasıl okuyup doğrularım?</h3>

      <details className={s.rehber}>
        <summary>Model numarasını nereden bulurum?</summary>
        <ul>
          <li><b>iPhone:</b> Ayarlar → Genel → Hakkında → Model Numarası. Dokununca parça numarası (M ile başlar, sonu TU/A gibi biter) ile A&apos;lı model numarası arasında geçiş yapar. Bölgeyi parça numarasının sonu gösterir.</li>
          <li><b>Samsung:</b> Ayarlar → Telefon hakkında → Model numarası (örn. SM-S918B). Son harf bölgeyi gösterir.</li>
          <li><b>Xiaomi / Poco ve Pixel:</b> Ayarlar → Telefon hakkında bölümünde model adı yazar.</li>
          <li><b>Her marka:</b> Kutudaki etiket ve <code>*#06#</code> ile açılan IMEI ekranı, ilandaki bilgiyle karşılaştırılmalı.</li>
        </ul>
      </details>

      <details className={s.rehber}>
        <summary>Bölge kodları ne anlama gelir?</summary>
        <div className={s.tabloKap}>
          <table className={s.tablo}>
            <thead><tr><th>Kod</th><th>Bölge</th></tr></thead>
            <tbody>
              <tr><td>iPhone TU/A</td><td>Türkiye (Apple Türkiye garantisi)</td></tr>
              <tr><td>iPhone B/A, ZD/A</td><td>Avrupa (İngiltere, Almanya)</td></tr>
              <tr><td>iPhone LL/A</td><td>ABD</td></tr>
              <tr><td>iPhone CH/A, J/A, KH/A</td><td>Çin, Japonya, Güney Kore</td></tr>
              <tr><td>Samsung …B</td><td>Global (Türkiye ve Avrupa dahil)</td></tr>
              <tr><td>Samsung …U, …U1</td><td>ABD</td></tr>
              <tr><td>Samsung …N, …0</td><td>Güney Kore, Çin</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <details className={s.rehber}>
        <summary>Exynos mu Snapdragon mı? Neden önemli?</summary>
        <p>
          Galaxy S21, S22, S24 ve S24+ modellerinde Türkiye, Avrupa ve global sürümler Exynos, ABD, Çin, Kore ve Japonya
          sürümleri Snapdragon taşır. İkisi pil ömrü, ısınma ve performansta farklı davranabilir, ikinci elde fiyatı da etkiler.
          S23, S24 Ultra ve S25 serisinde yonga bölgeye göre değişmez.
        </p>
      </details>

      <details className={s.rehber}>
        <summary>Güven skoru nasıl okunur?</summary>
        <p>
          Skor; model eşleşmesi, depolama, RAM, bölge ve model kodundan hesaplanır. %85 ve üstü net, %60–84 kısmi, altı
          belirsizdir. Net sonuç ilanın doğru olduğu anlamına gelmez: IMEI, kutu etiketi ve cihaz içindeki model numarasıyla
          mutlaka karşılaştır.
        </p>
      </details>

      <details className={s.rehber}>
        <summary>&quot;Çelişki&quot; uyarısı görürsem ne yapmalıyım?</summary>
        <p>
          Çelişki, ilandaki bilginin o modelde üretilmemiş bir kombinasyon olduğunu gösterir (örn. S24 Ultra 128GB).
          Satıcı hatası olabilir ama yanıltıcı ilan işareti de olabilir. Satıcıdan cihazın Ayarlar → Hakkında ekranının
          görüntüsünü iste.
        </p>
      </details>

      <details className={s.rehber}>
        <summary>Motorun sınırları neler?</summary>
        <p>
          Katalogda şu an 70 model var (iPhone 11–17, Galaxy S21–S25 ve A serisinden üç model, seçili Xiaomi / Poco ve Pixel
          modelleri). Listede olmayan cihaz için tahmin yürütmez, &quot;eşleşme yok&quot; der. Yazım hataları ve ilan
          başlığındaki fiyat, renk, pil yüzdesi gibi ekler otomatik temizlenir.
        </p>
      </details>
    </div>
  );
}