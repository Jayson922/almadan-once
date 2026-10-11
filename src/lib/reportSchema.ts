import { z } from "zod";
import type { ExpertiseReport } from "../types/report";

const riskLevelSchema = z.enum(["Düşük", "Orta", "Yüksek", "Kritik"]);

const kronikSorunSchema = z.object({
  sorun: z.string(),
  riskSeviyesi: riskLevelSchema,
  açıklama: z.string(),
});

const gorselKusurSchema = z.object({
  kusur: z.string(),
  ciddiyet: z.enum(["Kozmetik", "Orta", "Ciddi"]),
});

const dogrulanamayanIddiaSchema = z.object({
  iddia: z.string(),
  eldenKontrolTavsiyesi: z.string(),
});

const teknikDegerlendirmeSchema = z.object({
  markaModelVaryant: z.string(),
  güçlüYönler: z.array(z.string()),
  zayıfYönler: z.array(z.string()),
  kronikSorunlar: z.array(kronikSorunSchema),
  tahminiKalanÖmürYıl: z.number().min(0).max(50),
  tamirEdilebilirlikPuanı: z.number().min(0).max(10),
  görselKusurlar: z.array(gorselKusurSchema),
  doğrulanamayanİddialar: z.array(dogrulanamayanIddiaSchema),
  kozmetikDurum: z.string(),
  donanımDurum: z.string(),
  fiyatMantigi: z.string(),
});

const yonlendirmeSchema = z.object({
  platform: z.string(),
  url: z.string(),
  aciklama: z.string(),
});

export const expertiseReportSchema = z.object({
  arbitrajSkoru: z.number().min(0).max(100).nullable(),
  tavsiye: z.string(),
  tahminiPiyasaMin: z.number().nonnegative().nullable(),
  tahminiPiyasaMax: z.number().nonnegative().nullable(),
  yonlendirmeTavsiyeleri: z.array(yonlendirmeSchema),
  teknikDeğerlendirme: teknikDegerlendirmeSchema,
  riskRaporu: z.array(z.string()),
}) satisfies z.ZodType<ExpertiseReport>;

export type ReportValidation =
  | { ok: true; data: ExpertiseReport }
  | { ok: false; sorunlar: string[] };

/** Rapor sözleşmeye uyuyor mu? Uymuyorsa sorunlu alan yollarını döner. */
export function validateExpertiseReport(report: unknown): ReportValidation {
  const result = expertiseReportSchema.safeParse(report);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    sorunlar: result.error.issues.map((issue) => {
      const yol = issue.path.length > 0 ? issue.path.map(String).join(".") : "(rapor)";
      return `${yol}: ${issue.message}`;
    }),
  };
}