import { detectAllAts, detectAts, type AtsHit } from "./detect.ts";
import { scoutFetch, type MetricsRecorder } from "./http.ts";

/**
 * "Company Web Scan": given whatever the admin pasted (a careers page, a
 * homepage, or a direct ATS link), figure out which ATS board it uses.
 *
 *   1. The URL itself may already be an ATS link.
 *   2. Otherwise fetch the page and look for embedded/linked boards.
 *   3. Otherwise try the usual careers paths on the same site.
 */
export async function scanCompanySite(
  rec: MetricsRecorder,
  inputUrl: string,
): Promise<{ hit: AtsHit | null; all: AtsHit[]; checked: string[] }> {
  const direct = detectAts(inputUrl);
  if (direct) return { hit: direct, all: [direct], checked: [inputUrl] };

  const url = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  const candidates = [url.toString()];
  if (url.pathname === "/" || url.pathname === "") {
    for (const p of ["/careers", "/jobs", "/company/careers", "/about/careers", "/join-us"]) {
      candidates.push(new URL(p, url).toString());
    }
  }

  const checked: string[] = [];
  for (const candidate of candidates) {
    checked.push(candidate);
    let html: string;
    let finalUrl = candidate;
    try {
      const res = await scoutFetch(rec, "webscan", candidate, {
        accept: "text/html",
        timeoutMs: 10_000,
      });
      finalUrl = res.url || candidate;
      html = await res.text();
    } catch {
      continue;
    }
    // A redirect straight to the ATS counts too (e.g. /careers → jobs.lever.co/acme).
    const byKey = new Map<string, AtsHit>();
    for (const h of [detectAts(finalUrl), ...detectAllAts(html)]) {
      if (h) byKey.set(`${h.ats}:${h.token.toLowerCase()}`, h);
    }
    const all = [...byKey.values()];
    if (all.length) return { hit: all[0], all, checked };
  }
  return { hit: null, all: [], checked };
}
