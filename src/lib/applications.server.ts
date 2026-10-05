import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { APPLICATION_SELECT, type TalentApplication } from "@/lib/applications";
import { postingUrls } from "@/lib/autofill/autofill.server";
import { extractJobPostings } from "@/lib/scout/jobposting";
import { decodeEntities } from "@/lib/scout/text";

export type AddByUrlResult =
  | { ok: true; application: TalentApplication; detailsFound: boolean }
  | { ok: false; error: string };

type Details = { title: string | null; company: string | null; location: string | null };

/**
 * The URL is user input fetched from our server, so only plain public web
 * addresses are allowed: no localhost, IP literals or internal names.
 */
function publicUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.includes(":")) return null; // single-label names, IPv6
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) return null; // IPv4 literals
  if (/(^|\.)(localhost|local|internal|lan|home|corp|test|invalid)$/.test(host)) return null;
  return u;
}

/** Fetch the page, re-checking every redirect hop and capping how much we read. */
async function fetchPage(start: URL): Promise<string | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "SavantJobScout/1.0 (+https://savantstaffing.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = publicUrl(new URL(res.headers.get("location") ?? "", url).toString());
      if (!next) return null;
      url = next;
      continue;
    }
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 1_500_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
    return html;
  }
  return null;
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = decodeEntities(v)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : null;
};

function meta(html: string, name: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

/** JobPosting markup first (what Google for Jobs reads), then the page's own title tags. */
export function readDetails(html: string): Details {
  type Json = Record<string, unknown>;
  const p = extractJobPostings(html)[0];
  if (p) {
    const org = p.hiringOrganization as Json | string | undefined;
    const place = [p.jobLocation].flat()[0] as Json | undefined;
    const a = (place?.address ?? {}) as Json;
    const where = [clean(a.addressLocality, 80), clean(a.addressRegion, 80)]
      .filter(Boolean)
      .join(", ");
    const title = clean(p.title, 300);
    if (title)
      return {
        title,
        company: clean(typeof org === "object" && org ? org.name : org, 200),
        location:
          where || (String(p.jobLocationType).toUpperCase() === "TELECOMMUTE" ? "Remote" : null),
      };
  }
  return {
    title: clean(
      meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      300,
    ),
    company: clean(meta(html, "og:site_name"), 200),
    location: null,
  };
}

export async function addByUrl(
  supabase: SupabaseClient<Database>,
  userId: string,
  raw: string,
): Promise<AddByUrlResult> {
  const url = publicUrl(raw);
  if (!url) return { ok: false, error: "Paste the full web address of the job posting." };
  url.hash = "";
  const href = url.toString();

  // Already in Savant's feed? Link the real job so recruiter updates and autofill keep working.
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .in("apply_url", postingUrls(href))
    .limit(1)
    .maybeSingle();

  let details: Details = { title: null, company: null, location: null };
  if (!job) {
    try {
      const html = await fetchPage(url);
      if (html) details = readDetails(html);
    } catch {
      // Sites that block us or time out still get added, just without details.
    }
  }

  const { data, error } = await supabase
    .from("job_applications")
    .insert(
      job
        ? { applicant_id: userId, job_id: job.id, status: "started" }
        : {
            applicant_id: userId,
            status: "tracked",
            external_url: href,
            external_title: details.title,
            external_company: details.company ?? url.hostname.replace(/^www\./, ""),
            external_location: details.location,
          },
    )
    .select(APPLICATION_SELECT)
    .single();
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "That job is already on your list." : error.message,
    };
  return {
    ok: true,
    application: data as unknown as TalentApplication,
    detailsFound: !!job || !!details.title,
  };
}
