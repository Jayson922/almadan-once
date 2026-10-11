export type SectionStatus = "ok" | "error" | "skipped";

export interface SectionResult<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
  durationMs: number;
}

export class SectionTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`${name} bölümü ${timeoutMs} ms içinde tamamlanamadı`);
    this.name = "SectionTimeoutError";
  }
}

const FAILURE_MESSAGE = "Bu bölüm şu anda hesaplanamadı.";

function failure<T>(name: string, err: unknown, startedAt: number): SectionResult<T> {
  // Ayrıntı sunucu günlüğüne gider, istemciye yalnızca genel mesaj döner.
  console.error(`[safeRun:${name}]`, err);
  return {
    status: "error",
    data: null,
    error: err instanceof SectionTimeoutError ? err.message : FAILURE_MESSAGE,
    durationMs: Date.now() - startedAt,
  };
}

export function skipped<T = never>(reason: string): SectionResult<T> {
  return { status: "skipped", data: null, error: reason, durationMs: 0 };
}

export function safeRun<T>(name: string, fn: () => T): SectionResult<T> {
  const startedAt = Date.now();
  try {
    const data = fn();
    return { status: "ok", data, error: null, durationMs: Date.now() - startedAt };
  } catch (err) {
    return failure<T>(name, err, startedAt);
  }
}

export async function safeRunAsync<T>(
  name: string,
  fn: () => Promise<T>,
  timeoutMs = 20000
): Promise<SectionResult<T>> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SectionTimeoutError(name, timeoutMs)), timeoutMs);
    });
    const data = await Promise.race([fn(), timeout]);
    return { status: "ok", data, error: null, durationMs: Date.now() - startedAt };
  } catch (err) {
    return failure<T>(name, err, startedAt);
  } finally {
    if (timer) clearTimeout(timer);
  }
}