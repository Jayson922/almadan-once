import type { ExpertiseReport, ListingInputPayload, PiyasaAraligi } from "../types/report";
import { buildExpertiseReport } from "./expertiseReport";
import { validateExpertiseReport } from "./reportSchema";
import { safeRunAsync } from "./safeRun";
import type { ListingInput } from "./schemas";

export interface FullReportOptions {
  /** Yalnızca sunucuda hesaplanmış piyasa aralığı. İstemciden gelen değer buraya verilmemeli. */
  marketPrice?: PiyasaAraligi | null;
  timeoutMs?: number;
}

export type FullReportResult =
  | { durum: "ok"; rapor: ExpertiseReport; sureMs: number }
  | { durum: "error"; rapor: null; hata: string; sozlesmeSorunlari: string[]; sureMs: number };

export async function buildFullReport(
  input: ListingInput,
  options: FullReportOptions = {}
): Promise<FullReportResult> {
  const startedAt = Date.now();

  const payload: ListingInputPayload = {
    ...input,
    marketPrice: options.marketPrice ?? null,
  };

  const section = await safeRunAsync(
    "ekspertiz-raporu",
    () => buildExpertiseReport(payload),
    options.timeoutMs ?? 20000
  );

  if (section.status !== "ok" || section.data === null) {
    return {
      durum: "error",
      rapor: null,
      hata: section.error ?? "Rapor oluşturulamadı.",
      sozlesmeSorunlari: [],
      sureMs: Date.now() - startedAt,
    };
  }

  const validation = validateExpertiseReport(section.data);
  if (!validation.ok) {
    console.error("[buildFullReport] rapor sözleşmeye uymuyor:", validation.sorunlar);
    return {
      durum: "error",
      rapor: null,
      hata: "Rapor beklenen biçime uymadığı için gösterilemiyor.",
      sozlesmeSorunlari: validation.sorunlar,
      sureMs: Date.now() - startedAt,
    };
  }

  return { durum: "ok", rapor: validation.data, sureMs: Date.now() - startedAt };
}