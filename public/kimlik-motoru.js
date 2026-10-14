/*! Kimlik Motoru v1.0 - ikinci el telefon ürün kimliği çözümleyici
 *  Kullanım (tarayıcı): <script src="kimlik-motoru.js"></script>  ->  KimlikMotoru.identify("iphone 13 128 tr")
 *  Kullanım (Node):     const { identify } = require("./kimlik-motoru.js");
 *  Bağımlılık yok. Dosya UTF-8 kaydedilmelidir. */
(function (root) {
'use strict';
const norm=s=>s.replace(/İ/g,'i').toLowerCase().replace(/[çğıöşü]/g,c=>({ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}[c]));
const slug=s=>norm(s).replace(/\+/g,'plus').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fmt=s=>s>=1024?s/1024+'TB':s+'GB';
/* ---- Katalog: marka|model|yıl|RAM|depolama|yonga(~bölgeye göre ikinci)|ekran (L=LCD) ---- */
const BN={A:'Apple',S:'Samsung',X:'Xiaomi / Poco',G:'Google'};
const D=`A|iPhone 11|2019|4|64,128,256|A13 Bionic|6.1L
A|iPhone 11 Pro|2019|4|64,256,512|A13 Bionic|5.8
A|iPhone 11 Pro Max|2019|4|64,256,512|A13 Bionic|6.5
A|iPhone 12 mini|2020|4|64,128,256|A14 Bionic|5.4
A|iPhone 12|2020|4|64,128,256|A14 Bionic|6.1
A|iPhone 12 Pro|2020|6|128,256,512|A14 Bionic|6.1
A|iPhone 12 Pro Max|2020|6|128,256,512|A14 Bionic|6.7
A|iPhone 13 mini|2021|4|128,256,512|A15 Bionic|5.4
A|iPhone 13|2021|4|128,256,512|A15 Bionic|6.1
A|iPhone 13 Pro|2021|6|128,256,512,1024|A15 Bionic|6.1
A|iPhone 13 Pro Max|2021|6|128,256,512,1024|A15 Bionic|6.7
A|iPhone 14|2022|6|128,256,512|A15 Bionic|6.1
A|iPhone 14 Plus|2022|6|128,256,512|A15 Bionic|6.7
A|iPhone 14 Pro|2022|6|128,256,512,1024|A16 Bionic|6.1
A|iPhone 14 Pro Max|2022|6|128,256,512,1024|A16 Bionic|6.7
A|iPhone 15|2023|6|128,256,512|A16 Bionic|6.1
A|iPhone 15 Plus|2023|6|128,256,512|A16 Bionic|6.7
A|iPhone 15 Pro|2023|8|128,256,512,1024|A17 Pro|6.1
A|iPhone 15 Pro Max|2023|8|256,512,1024|A17 Pro|6.7
A|iPhone 16|2024|8|128,256,512|A18|6.1
A|iPhone 16 Plus|2024|8|128,256,512|A18|6.7
A|iPhone 16 Pro|2024|8|128,256,512,1024|A18 Pro|6.3
A|iPhone 16 Pro Max|2024|8|256,512,1024|A18 Pro|6.9
A|iPhone 17|2025|8|256,512|A19|6.3
A|iPhone Air|2025|12|256,512,1024|A19 Pro|6.5
A|iPhone 17 Pro|2025|12|256,512,1024|A19 Pro|6.3
A|iPhone 17 Pro Max|2025|12|256,512,1024,2048|A19 Pro|6.9
S|Galaxy S21|2021|8|128,256|Exynos 2100~Snapdragon 888|6.2
S|Galaxy S21+|2021|8|128,256|Exynos 2100~Snapdragon 888|6.7
S|Galaxy S21 Ultra|2021|12,16|128,256,512|Exynos 2100~Snapdragon 888|6.8
S|Galaxy S22|2022|8|128,256|Exynos 2200~Snapdragon 8 Gen 1|6.1
S|Galaxy S22+|2022|8|128,256|Exynos 2200~Snapdragon 8 Gen 1|6.6
S|Galaxy S22 Ultra|2022|8,12|128,256,512,1024|Exynos 2200~Snapdragon 8 Gen 1|6.8
S|Galaxy S23|2023|8|128,256,512|Snapdragon 8 Gen 2 for Galaxy|6.1
S|Galaxy S23+|2023|8|256,512|Snapdragon 8 Gen 2 for Galaxy|6.6
S|Galaxy S23 Ultra|2023|8,12|256,512,1024|Snapdragon 8 Gen 2 for Galaxy|6.8
S|Galaxy S24|2024|8|128,256,512|Exynos 2400~Snapdragon 8 Gen 3 for Galaxy|6.2
S|Galaxy S24+|2024|12|256,512|Exynos 2400~Snapdragon 8 Gen 3 for Galaxy|6.7
S|Galaxy S24 Ultra|2024|12|256,512,1024|Snapdragon 8 Gen 3 for Galaxy|6.8
S|Galaxy S24 FE|2024|8|128,256,512|Exynos 2400e|6.7
S|Galaxy S25|2025|12|128,256,512|Snapdragon 8 Elite for Galaxy|6.2
S|Galaxy S25+|2025|12|256,512|Snapdragon 8 Elite for Galaxy|6.7
S|Galaxy S25 Ultra|2025|12,16|256,512,1024|Snapdragon 8 Elite for Galaxy|6.9
S|Galaxy A35 5G|2024|6,8|128,256|Exynos 1380|6.6
S|Galaxy A54 5G|2023|6,8|128,256|Exynos 1380|6.4
S|Galaxy A55 5G|2024|8,12|128,256|Exynos 1480|6.6
X|Redmi Note 12 4G|2023|4,6,8|64,128,256|Snapdragon 685|6.67
X|Redmi Note 12 5G|2023|4,6,8|128,256|Snapdragon 4 Gen 1|6.67
X|Redmi Note 13 4G|2024|6,8|128,256|Helio G99 Ultra|6.67
X|Redmi Note 13 5G|2024|6,8,12|128,256,512|Dimensity 6080|6.67
X|Redmi Note 13 Pro 5G|2024|8,12|128,256,512|Snapdragon 7s Gen 2|6.67
X|Redmi Note 13 Pro+ 5G|2024|8,12|256,512|Dimensity 7200 Ultra|6.67
X|Poco X6 Pro 5G|2024|8,12|256,512|Dimensity 8300 Ultra|6.67
X|Poco F6|2024|8,12|256,512|Snapdragon 8s Gen 3|6.67
X|Poco X7 Pro|2025|8,12|256,512|Dimensity 8400 Ultra|6.67
X|Xiaomi 13T|2023|8,12|256|Dimensity 8200 Ultra|6.67
X|Xiaomi 14T|2024|12|256,512|Dimensity 8300 Ultra|6.67
G|Pixel 7|2022|8|128,256|Tensor G2|6.3
G|Pixel 7 Pro|2022|12|128,256,512|Tensor G2|6.7
G|Pixel 7a|2023|8|128|Tensor G2|6.1
G|Pixel 8|2023|8|128,256|Tensor G3|6.2
G|Pixel 8 Pro|2023|12|128,256,512,1024|Tensor G3|6.7
G|Pixel 8a|2024|8|128,256|Tensor G3|6.1
G|Pixel 9|2024|12|128,256|Tensor G4|6.3
G|Pixel 9 Pro|2024|16|128,256,512,1024|Tensor G4|6.3
G|Pixel 9 Pro XL|2024|16|128,256,512,1024|Tensor G4|6.8
G|Pixel 9a|2025|8|128,256|Tensor G4|6.3
G|Pixel 10|2025|12|128,256|Tensor G5|6.3
G|Pixel 10 Pro|2025|16|128,256,512,1024|Tensor G5|6.3
G|Pixel 10 Pro XL|2025|16|256,512,1024|Tensor G5|6.8`;
const BR={apple:'A',iphone:'A',samsung:'S',galaxy:'S',xiaomi:'X',redmi:'X',poco:'X',google:'G',pixel:'G'};
const STOP=new Set('apple samsung galaxy xiaomi google ram gb tb tl ikinci el sifir cihaz telefon yeni kutulu faturali garantili temiz acil satilik ve ile model mi'.split(' '));
const FAM=['iphone','pixel','redmi','poco'];let VOC=new Set();
const CODE={S918:'Galaxy S23 Ultra',S911:'Galaxy S23',S916:'Galaxy S23+',S908:'Galaxy S22 Ultra',S901:'Galaxy S22',S906:'Galaxy S22+',S928:'Galaxy S24 Ultra',S921:'Galaxy S24',S926:'Galaxy S24+',S721:'Galaxy S24 FE',S931:'Galaxy S25',S936:'Galaxy S25+',S938:'Galaxy S25 Ultra',G998:'Galaxy S21 Ultra',G991:'Galaxy S21',G996:'Galaxy S21+',A546:'Galaxy A54 5G',A556:'Galaxy A55 5G',A356:'Galaxy A35 5G'};
const SFX={B:'GL',U:'US',U1:'US',W:'US',N:'KR','0':'CN'};
const AP={TU:'TR',B:'EU',ZD:'EU',LL:'US',CH:'CN',J:'JP',KH:'KR',X:'GL',ZP:'GL',ZA:'GL',HN:'GL',TH:'GL'};
const RL={TR:'Türkiye',EU:'Avrupa / UK',US:'ABD',CN:'Çin',KR:'Güney Kore',JP:'Japonya',GL:'Global / uluslararası'};
const RT={TR:'tr',EU:'eu',US:'us',CN:'cn',KR:'kr',JP:'jp',GL:'global'};
const RX={TR:/\b(tr|turkiye|turk|turkce)\b/,EU:/\b(eu|avrupa|uk|almanya|ingiltere)\b/,US:/\b(us|usa|abd|amerika)\b/,CN:/\b(cn|cin|china)\b/,KR:/\b(kr|kore|korea)\b/,JP:/\b(jp|japonya|japan)\b/,GL:/\b(global|intl|uluslararasi|yurtdisi)\b/};
const RAMS=[2,3,4,6,8,12,16,18,24],STO=[32,64,128,256,512,1024,2048];
function lev(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]==b[j-1]?0:1));
 if(i>1&&j>1&&a[i-1]==b[j-2]&&a[i-2]==b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[a.length][b.length]}
function tk(s,fx){const br=new Set();
 s=norm(s).replace(/\+/g,' plus ').replace(/\bip(?=\d)/g,'iphone ').replace(/\b(iphone|pixel)(?=\d)/g,'$1 ').replace(/\brn\s?(?=\d)/g,'redmi note ').replace(/\bnote(?=\d)/g,'note ')
 .replace(/\b(\d{1,2})(promax|pro|pm|plus|mini|max)\b/g,'$1 $2').replace(/\b(promax|pm)\b/g,'pro max')
 .replace(/\b([sa]\d{2,3})(ultra|u|fe|plus)\b/g,(a,b,c)=>b+' '+(c=='u'?'ultra':c));
 const t=s.split(/[^a-z0-9]+/).filter(Boolean).map(w=>{
  if(VOC.size&&!/\d/.test(w)&&w.length>=5&&!VOC.has(w)){let b=null,bd=w.length>=8?2:1;VOC.forEach(v=>{const d=lev(w,v);if(d<=bd&&Math.abs(v.length-w.length)<=2){bd=d;b=v}});if(b){fx&&fx.push(w+' → '+b);w=b}}
  if(BR[w])br.add(BR[w]);return w}).filter(w=>!STOP.has(w)&&(w.length>1||/\d/.test(w))&&!/^\d{4,}$/.test(w)&&(!VOC.size||/\d/.test(w)||VOC.has(w)));
 return{t,br}}
const M=D.split('\n').map(l=>{const[b,n,y,r,s,c,z]=l.split('|');return{b,n,y:+y,r:r.split(',').map(Number),s:s.split(',').map(Number),c:c.split('~'),z:parseFloat(z),lcd:/L$/.test(z),tk:new Set(tk(n).t)}});
VOC=new Set([...STOP,...FAM,'note','pro','max','plus','ultra','mini','fe','xl',...M.flatMap(m=>[...m.tk]).filter(w=>!/\d/.test(w))]);
/* ---- Ayrıştırma ---- */
function parse(raw){const o={region:null,rs:'',storage:null,ram:null,code:null,sfx:'',fx:[],sig:[]};let s=raw,m;
 if(m=s.match(/\bSM-?([A-Z]\d{3})([A-Z]?\d?)/i)){o.code=m[1].toUpperCase();o.sfx=m[2].toUpperCase();s=s.replace(m[0],' ');o.sig.push('Model kodu SM-'+o.code+o.sfx);if(SFX[o.sfx]){o.region=SFX[o.sfx];o.rs='kod soneki '+o.sfx}}
 if((m=s.match(/\b\w*?([A-Z]{1,2})\/A\b/i))&&AP[m[1].toUpperCase()]){s=s.replace(m[0],' ');if(!o.region){o.region=AP[m[1].toUpperCase()];o.rs='Apple parça no '+m[1].toUpperCase()+'/A'}o.sig.push('Parça no soneki '+m[1].toUpperCase()+'/A')}
 let n=norm(s).replace(/%\s?\d{1,3}|\b(?:pil|batarya)\s?(?:sagligi|saglik)?\s?\d{2,3}\b/g,' ').replace(/\d{1,3}(?:\.\d{3})+\s?(?:tl)?|₺\s?\d+|\b\d+\s?(?:tl|bin)\b|\b\d+\s?(?:ay|aylik|yil)\b/g,' ');
 for(const k in RX)if(RX[k].test(n)){if(!o.region){o.region=k;o.rs='metinden'}n=n.replace(new RegExp(RX[k].source,'g'),' ')}
 const pr=(a,r,st,u)=>{r=+r;st=+st*(u=='tb'?1024:1);if(RAMS.includes(r)&&STO.includes(st)){o.ram=r;o.storage=st;return' '}return a};
 n=n.replace(/(?<![a-z\d.])(\d{1,2})\s?(?:gb)?\s?\/\s?(\d{2,4})\s?(gb|tb)?/g,pr).replace(/(?<![a-z\d.])(\d{1,2})\s?gb\s?\+\s?(\d{1,4})\s?(gb|tb)/g,pr);
 n=n.replace(/(\d+(?:\.\d+)?)\s?(gb|tb)\b(\s?ram)?/g,(a,v,u,r)=>{v=+v;if(u=='tb')o.storage=v*1024;else if(r||v<=24)o.ram=v;else o.storage=v;return' '});
 n=n.replace(/\b(64|128|256|512)\b/,(a,v)=>{if(!o.storage)o.storage=+v;return' '});
 const r=tk(n,o.fx);o.t=new Set(r.t);o.br=r.br;return o}
function score(p,m){const C=new Set(m.tk);FAM.forEach(f=>{if(C.has(f)&&!p.t.has(f))C.delete(f)});
 let q=[...p.t];if(!C.has('4g')&&!C.has('5g'))q=q.filter(t=>t!='4g'&&t!='5g');if(!q.length)return 0;
 let d=2*q.filter(t=>C.has(t)).length/(q.length+C.size);
 if(q.some(t=>/\d/.test(t)&&!C.has(t)))d*=.5;if(q.some(t=>FAM.includes(t)&&!C.has(t)))d*=.3;if(p.br.size&&!p.br.has(m.b))d*=.4;return d}
/* ---- Kimlik çözümleme ---- */
function ident(raw){const p=parse(raw);let L=[];const cm=p.code&&M.find(x=>x.n==CODE[p.code]);
 if(cm)L.push({m:cm,s:1,k:1});if(p.t.size)M.forEach(m=>{if(m!=cm)L.push({m,s:score(p,m)})});
 L.sort((a,b)=>b.s-a.s);const top=L[0];
 if(!top||top.s<.45)return{p,none:1,near:L.filter(l=>l.s>.2).slice(0,4)};
 const m=top.m,tie=top.k?[]:L.filter(l=>l!=top&&top.s-l.s<.1&&l.s>=.45),st=p.storage,rm=p.ram,reg=p.region;
 const stOk=st?m.s.includes(st):null,rmOk=rm?m.r.includes(rm):null,ram=rm||(m.r.length==1?m.r[0]:null),pair=m.c.length>1;
 const chip=pair?(reg?(['TR','EU','GL'].includes(reg)?m.c[0]:m.c[1]):null):m.c[0];
 let sim=null;if(m.b=='A'){if(m.n=='iPhone Air')sim='Yalnız eSIM';else if(m.y>=2025)sim=reg=='US'?'Yalnız eSIM (fiziksel yuva yok)':'Bölgeye bağlı; cihaz ayarlarından doğrula';
  else if(reg=='CN')sim='2 × fiziksel nano-SIM (eSIM yok)';else if(m.y>=2022)sim=reg=='US'?'Yalnız eSIM (fiziksel yuva yok)':reg?'Nano-SIM + eSIM':'Bölgeye bağlı (ABD: yalnız eSIM, Çin: çift fiziksel)';else sim='Nano-SIM + eSIM'}
 const wr=[],am=[],cur={m,storage:st,ram:rm,region:reg};
 if(tie.length)am.push({q:'Birden fazla model aynı derecede uyuyor. Hangisi?',o:[top,...tie].slice(0,5).map(l=>[l.m.n,{m:l.m}])});
 if(!st)am.push({q:'Depolama kaç GB?',o:m.s.map(s=>[fmt(s),{storage:s}])});
 if(!rm&&m.r.length>1)am.push({q:'RAM miktarı?',o:m.r.map(r=>[r+' GB',{ram:r}])});
 if(!reg)am.push({q:pair?'Yonga seti bölgeye göre değişiyor. Cihaz hangi bölgenin?':'Hangi bölge sürümü? Garanti ve ağ uyumu buna bağlı.',o:Object.keys(RL).filter(k=>pair||['TR','EU','US','CN','GL'].includes(k)).map(k=>[RL[k],{region:k}])});
 if(st&&!stOk)wr.push(['bad',`${m.n} için ${fmt(st)} seçeneği üretilmedi. Mevcut: ${m.s.map(fmt).join(', ')}. İlan başlığı hatalı ya da model yanlış olabilir.`]);
 if(rm&&!rmOk)wr.push(['bad',`${m.n} için ${rm} GB RAM seçeneği yok. Mevcut: ${m.r.join(', ')} GB.`]);
 if(pair&&reg)wr.push(['info',`Bu model bölgeye göre farklı yonga kullanıyor: ${m.c[0]} (Türkiye / Avrupa / global) ve ${m.c[1]} (ABD, Çin, Kore, Japonya). Seçilen bölge: ${chip}.`]);
 if(m.b=='A'){if(reg=='TR')wr.push(['info','TU/A işaretli kutu, Apple Türkiye garantili yerel sürüm anlamına gelir.']);else if(reg)wr.push(['warn','Yurt dışı sürümü: Apple Türkiye garantisi kapsamayabilir. Kutu etiketini ve IMEI kaydını kontrol et.']);}
 if(m.b=='S'&&reg=='US')wr.push(['warn','ABD (U / U1) sürümlerinde Türkiye garantisi ve bant uyumu sorun olabilir.']);
 if(m.b=='S'&&reg=='CN')wr.push(['warn','Çin / HK sürümlerinde yazılım ve Google hizmetleri farklı olabilir.']);
 if(m.b=='X'&&reg=='CN')wr.push(['warn','Çin ROM sürümlerinde Google hizmetleri ve Türkçe dil için global ROM gerekebilir.']);
 if(m.b=='G')wr.push(['warn','Pixel serisinin Türkiye resmî satışı sınırlı olabilir. Garanti, bant ve eSIM uyumunu doğrula.']);
 if(p.fx.length)p.sig.push('Yazım düzeltildi: '+p.fx.join(', '));
 if(st)p.sig.push('Depolama '+fmt(st));if(rm)p.sig.push('RAM '+rm+' GB');if(reg)p.sig.push('Bölge '+reg+' ('+p.rs+')');
 let c=top.s*50+(st?(stOk?15:-10):0)+(rm?(rmOk?10:-10):(m.r.length==1?10:0))+(reg?10:0)+(top.k?15:0)-(tie.length?15:0);c=Math.max(5,Math.min(100,Math.round(c)));
 const id=[slug(BN[m.b]),slug(m.n),st?fmt(st).toLowerCase():'?',ram?ram+'gb':'?',reg?RT[reg]:'?'].concat(pair&&chip?[slug(chip)]:[]).join('.');
 return{p,top,L,m,tie,st,rm,reg,stOk,rmOk,ram,pair,chip,sim,wr,am,cur,c,id,code:!!top.k}}

/* ---- Genel API ---- */
function identify(raw) {
  raw = String(raw == null ? '' : raw).trim();
  if (!raw) return { eslesme: false, guven: 0, durum: 'bos', oneriler: [] };
  const r = ident(raw);
  if (r.none) return { eslesme: false, guven: 0, durum: 'eslesme_yok', oneriler: r.near.map(l => l.m.n) };
  const m = r.m, c = r.c;
  return {
    eslesme: true,
    guven: c,
    durum: c >= 85 ? 'net' : c >= 60 ? 'kismi' : 'belirsiz',
    marka: BN[m.b],
    model: m.n,
    yil: m.y,
    depolamaGB: r.st || null,
    ramGB: r.ram || null,
    yongaSeti: r.chip || m.c.join(' / '),
    bolge: r.reg || null,
    bolgeAdi: r.reg ? RL[r.reg] : null,
    sim: r.sim || null,
    ekranInc: m.z,
    ekranTipi: m.lcd ? 'LCD' : 'OLED',
    kimlik: r.id,
    kodlaDogrulandi: r.code,
    form: {
      marka: BN[m.b],
      model: m.n,
      depolama: r.st ? fmt(r.st) : null,
      ram: r.ram ? r.ram + 'GB' : null
    },
    secenekler: { depolama: m.s.map(fmt), ram: m.r.map(x => x + 'GB') },
    belirsizlikler: r.am.map(a => ({ soru: a.q, secenekler: a.o.map(o => o[0]) })),
    uyarilar: r.wr.map(w => ({ seviye: w[0], mesaj: w[1] })),
    adaylar: r.L.filter(l => l.s >= .3).slice(0, 5).map(l => ({ model: l.m.n, skor: Math.round(l.s * 100) })),
    sinyaller: r.p.sig
  };
}
const api = { identify: identify, katalogBoyutu: M.length, surum: '1.0' };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KimlikMotoru = api;
})(typeof self !== 'undefined' ? self : this);