export interface FraudRiskAnalysis {
  riskScore: number;
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
  warnings: string[];
  recommendations: string[];
}

export function analyzeFraudRisk(notes: string = '', price: number, estimatedMin: number): FraudRiskAnalysis {
  const text = notes.toLowerCase();
  const warnings: string[] = [];
  let riskScore = 10;

  if (text.includes('kapora') || text.includes('ön ödeme') || text.includes('depozito')) {
    riskScore += 40;
    warnings.push('İlan açıklamasında "kapora" veya "ön ödeme" talebi tespit edildi. Kesinlikle ürün görülmeden para gönderilmemelidir.');
  }

  if (text.includes('param güvende dışı') || text.includes('elden havale') || text.includes('eft ile')) {
    riskScore += 25;
    warnings.push('Güvenli ödeme sistemleri (Param Güvende vb.) dışına yönlendirme şüphesi bulunuyor.');
  }

  if (text.includes('acil') || text.includes('şehir dışındayım')) {
    riskScore += 20;
    warnings.push('Satıcının yüz yüze görüşmekten kaçınma ihtimaline karşı dikkatli olunmalıdır.');
  }

  if (price < estimatedMin * 0.6) {
    riskScore += 30;
    warnings.push('Fiyat piyasa ortalamasının çok altında ("Dolandırıcı İlanı" riski olabilir).');
  }

  const riskLevel: 'Düşük' | 'Orta' | 'Yüksek' = 
    riskScore > 60 ? 'Yüksek' : 
    riskScore > 30 ? 'Orta' : 'Düşük';

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    warnings: warnings.length > 0 ? warnings : ['Standart ikinci el riskleri dışında olağan dışı bir tehdit saptanmadı.'],
    recommendations: [
      'Ürünü mutlaka elden, bizzat görerek ve test ederek teslim alınız.',
      'Param Güvende veya benzeri resmi emanet hesap/ödeme altyapılarını tercih ediniz.'
    ]
  };
}