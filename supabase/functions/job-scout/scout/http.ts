// Generated from src/lib/scout/http.ts by scripts/build-scout-function.mjs. Do not edit.
/**
 * Instrumented fetch for the scout. Every outbound request is recorded per
 * source so /admin/diagnostics can show HTTP status mix, success rate,
 * rate-limit health and response times without any extra logging.
 */

type Sample = { status: number; ms: number };

export class MetricsRecorder {
  private samples = new Map<string, Sample[]>();

  record(source: string, status: number, ms: number) {
    const list = this.samples.get(source) ?? [];
    list.push({ status, ms });
    this.samples.set(source, list);
  }

  sources(): string[] {
    return [...this.samples.keys()];
  }

  summary(source: string) {
    const list = this.samples.get(source) ?? [];
    const status_counts: Record<string, number> = {};
    for (const s of list)
      status_counts[String(s.status)] = (status_counts[String(s.status)] ?? 0) + 1;
    const times = list.map((s) => s.ms).sort((a, b) => a - b);
    return {
      requests: list.length,
      successes: list.filter((s) => s.status >= 200 && s.status < 300).length,
      rate_limited: list.filter((s) => s.status === 429).length,
      status_counts,
      avg_response_ms: times.length
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null,
      p95_response_ms: times.length
        ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]
        : null,
    };
  }
}

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
    this.status = status;
    this.url = url;
  }
}

const USER_AGENT = "SavantJobScout/1.0 (+https://savantstaffing.com)";

/**
 * GET with timeout, and one polite retry on 429/5xx honoring Retry-After.
 * Status 0 in the metrics means a network error or timeout.
 */
export async function scoutFetch(
  recorder: MetricsRecorder,
  source: string,
  url: string,
  opts: {
    accept?: string;
    timeoutMs?: number;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const attempt = async () => {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept ?? "application/json",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
          ...opts.headers,
        },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        redirect: "follow",
      });
      recorder.record(source, res.status, Date.now() - started);
      return res;
    } catch (error) {
      recorder.record(source, 0, Date.now() - started);
      throw error;
    }
  };

  let res = await attempt();
  if (res.status === 429 || res.status >= 500) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 1500;
    await new Promise((r) => setTimeout(r, waitMs));
    res = await attempt();
  }
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function scoutJson<T>(
  recorder: MetricsRecorder,
  source: string,
  url: string,
  opts?: Parameters<typeof scoutFetch>[3],
): Promise<T> {
  const res = await scoutFetch(recorder, source, url, opts);
  return (await res.json()) as T;
}

/** Run `fn` over `items` with at most `limit` in flight — keeps us polite to each ATS. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
