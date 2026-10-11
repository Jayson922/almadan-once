import React from 'react';
import { TeknikDeğerlendirme } from '@/types/analysis';

interface TechnicalSpecsCardProps {
  data: TeknikDeğerlendirme;
}

export const TechnicalSpecsCard: React.FC<TechnicalSpecsCardProps> = ({ data }) => {
  return (
    <div className="relative overflow-hidden bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-8 text-slate-100 shadow-2xl space-y-6 transition-all duration-300">
      
      {/* Arka Plan Neon Işıma Efekti (Fintech Terminal Havası) */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Üst Bilgi Alanı */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60 shadow-inner">
              Canlı Teknik Ekspertiz & Risk Motoru
            </span>
          </div>
          <h2 className="text-2xl font-extrabold mt-3 text-white tracking-tight">{data.markaModelVaryant}</h2>
        </div>

        {/* Skor Özet Kartları */}
        <div className="flex items-center gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-right px-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Tahmini Ömür</div>
            <div className="text-base font-black text-emerald-400">~{data.tahminiKalanÖmürYıl} Yıl</div>
          </div>
          <div className="h-9 w-px bg-slate-800" />
          <div className="text-right px-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Tamir Skoru</div>
            <div className="text-base font-black text-cyan-400">{data.tamirEdilebilirlikPuanı}/10</div>
          </div>
        </div>
      </div>

      {/* Güçlü ve Zayıf Yönler Grid Yapısı */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Güçlü Yönler */}
        <div className="bg-emerald-950/15 border border-emerald-900/30 rounded-2xl p-5 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2.5">
            <span className="text-base">🛡️</span> Güçlü ve Olumlu Yönler
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.güçlüYönler?.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span> 
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Zayıf Yönler */}
        <div className="bg-amber-950/15 border border-amber-900/30 rounded-2xl p-5 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2.5">
            <span className="text-base">⚠️</span> Dikkat Edilmesi Gerekenler
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.zayıfYönler?.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-amber-500 font-bold mt-0.5">!</span> 
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Bilinen Kronik Sorunlar Bölümü */}
      {data.kronikSorunlar && data.kronikSorunlar.length > 0 && (
        <div className="relative z-10 space-y-3 pt-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2.5">
            <span className="text-base">⚡</span> Bilinen Kronik Riskler ve Donanım Eğilimleri
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {data.kronikSorunlar.map((chronic, idx) => {
              const riskColor = 
                chronic.riskSeviyesi === 'Yüksek' ? 'bg-red-950/50 text-red-400 border-red-800/60' :
                chronic.riskSeviyesi === 'Orta' ? 'bg-amber-950/50 text-amber-400 border-amber-800/60' :
                'bg-blue-950/50 text-blue-400 border-blue-800/60';

              return (
                <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <div className="font-semibold text-white text-sm flex items-center gap-2">
                      {chronic.sorun}
                    </div>
                    <div className="text-xs text-slate-400 leading-normal">{chronic.açıklama}</div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-xl font-bold uppercase tracking-wider w-fit h-fit border ${riskColor}`}>
                    {chronic.riskSeviyesi} Risk
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fiziksel / Görsel Durum & Elden Kontrol Tavsiyesi */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-800/80 pt-6">
        
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span>👁️</span> Görsel / Kozmetik Durum
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            {data.kozmetikDurum}
          </p>
        </div>

        <div className="bg-cyan-950/20 border border-cyan-900/40 rounded-2xl p-5 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
            <span>🔍</span> Kritik Elden Kontrol Tavsiyesi
          </h4>
          <p className="text-sm text-cyan-200/90 leading-relaxed">
            {data.doğrulanamayanİddialar?.[0]?.eldenKontrolTavsiyesi || 'Ürünü elden teslim alırken tüm fonksiyonları ve parçaları bizzat test edin.'}
          </p>
        </div>

      </div>

    </div>
  );
};