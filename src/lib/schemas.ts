import { z } from "zod";
import type { ListingInputPayload } from "../types/report";

export const MAX_PRICE_TL = 100_000_000;

/**
 * İstemciden gelen girdi şeması.
 * marketPrice bilerek YOK: piyasa aralığı yalnızca sunucuda hesaplanır.
 * Şemada tanımlı olmayan alanlar sessizce atılır.
 */
export const listingInputSchema = z.object({
  modelName: z
    .string({ error: "Model adı metin olmalı." })
    .trim()
    .min(2, "Model adı en az 2 karakter olmalı.")
    .max(120, "Model adı en fazla 120 karakter olabilir.")
    .optional(),
  price: z
    .number({ error: "Fiyat sayı olmalı." })
    .positive("Fiyat 0'dan büyük olmalı.")
    .max(MAX_PRICE_TL, "Fiyat makul sınırın üzerinde.")
    .optional(),
  notes: z
    .string({ error: "Notlar metin olmalı." })
    .trim()
    .max(5000, "Notlar en fazla 5000 karakter olabilir.")
    .optional(),
  features: z
    .array(
      z
        .string({ error: "Özellik metin olmalı." })
        .trim()
        .min(1, "Boş özellik girilemez.")
        .max(100, "Bir özellik en fazla 100 karakter olabilir."),
      { error: "Özellikler liste olmalı." }
    )
    .max(30, "En fazla 30 özellik girilebilir.")
    .optional(),
}) satisfies z.ZodType<ListingInputPayload>;

export type ListingInput = z.infer<typeof listingInputSchema>;

export interface InputFieldError {
  alan: string;
  mesaj: string;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; hatalar: InputFieldError[] };

export function parseListingInput(body: unknown): ParseResult<ListingInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      hatalar: [{ alan: "(govde)", mesaj: "İstek gövdesi bir nesne olmalı." }],
    };
  }
  const result = listingInputSchema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    hatalar: result.error.issues.map((issue) => ({
      alan: issue.path.length > 0 ? issue.path.map(String).join(".") : "(govde)",
      mesaj: issue.message,
    })),
  };
}