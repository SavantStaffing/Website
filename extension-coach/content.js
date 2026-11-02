// Savant Coach page reader. Injected on demand by the side panel (never on its own), it
// only reads: it collects what the open job posting says about itself and returns it.
// It does not click, type, or change the page.
(() => {
  if (window.__savantCoachRead) return;

  // Same pattern as CLOSED_RE in src/lib/coach/listing.ts; keep them in step.
  const CLOSED_RE =
    /\b(no longer (accepting|available|open|taking)|(position|job|role|posting|requisition|vacancy) (has been |is |was )?(filled|closed|expired|removed|cancell?ed)|(this|the) (job|position|posting|role) (has )?(expired|been (closed|filled|removed))|applications? (are |is )?(now )?closed|not (currently )?accepting (new )?applications|job (is )?no longer|we('| a)re no longer (hiring|accepting))\b/i;
  const POSTED_RE =
    /\b(posted|listed|published|reposted|date posted)\b[^.\n]{0,20}?(\d+\+?\s*(day|week|month|year)s?\s+ago|today|yesterday|(a|an|over a|more than a)\s+(day|week|month|year)\s+ago|over a year ago)/i;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const isType = (o, t) => asArray(o && o["@type"]).some((x) => String(x).toLowerCase() === t);
  const visible = (el) => !!(el.offsetParent || el.getClientRects().length);

  function htmlToText(html) {
    if (!html) return "";
    const spaced = String(html).replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, "\n");
    return new DOMParser().parseFromString(spaced, "text/html").body.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  }

  function jobPosting() {
    let found = null;
    const visit = (node) => {
      if (found || !node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (isType(node, "jobposting")) { found = node; return; }
      visit(node["@graph"]);
      visit(node.itemListElement);
      visit(node.item);
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { visit(JSON.parse(s.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ""))); } catch { /* broken JSON-LD */ }
      if (found) break;
    }
    return found;
  }

  function locationOf(p) {
    for (const place of asArray(p.jobLocation)) {
      const a = (place && place.address) || {};
      const country = a.addressCountry && typeof a.addressCountry === "object" ? a.addressCountry.name : a.addressCountry;
      const text = [a.addressLocality, a.addressRegion, country].filter(Boolean).join(", ");
      if (text) return text;
    }
    return String(p.jobLocationType || "").toUpperCase() === "TELECOMMUTE" ? "Remote" : null;
  }

  const meta = (name) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") || null;

  function mainText() {
    const picks = [
      "[data-automation-id='jobPostingDescription']", "#content", ".posting-page", ".job__description",
      "[class*='job-description']", "[class*='jobDescription']", "[class*='description']", "main", "article",
    ];
    let best = "";
    for (const sel of picks) {
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.innerText || "").trim();
        if (t.length > best.length && t.length < 40000) best = t;
      }
      if (best.length > 400) break;
    }
    return best || (document.body.innerText || "").trim();
  }

  function read() {
    const p = jobPosting();
    const body = (document.body.innerText || "").slice(0, 12000);
    const markupText = p ? htmlToText(p.description) : "";
    const description = markupText.length > 100 ? markupText : mainText();
    const closed = CLOSED_RE.exec(body);
    const applyEl = [...document.querySelectorAll("a, button, input[type='submit']")].find(
      (el) => visible(el) && /^(apply|apply now|apply for (this )?(job|role|position)|submit application|easy apply|start application)\b/i.test(clean(el.innerText || el.value)),
    );
    const posted = POSTED_RE.exec(body);
    const looksLikePosting = !!p || (description.length > 300 && !!applyEl) || !!closed;
    const org = p && p.hiringOrganization;

    return {
      url: location.href.split("#")[0],
      title: clean((p && p.title) || document.querySelector("h1")?.innerText || meta("og:title") || document.title) || null,
      company: clean((org && (org.name || org)) || meta("og:site_name") || "") || null,
      location: (p && locationOf(p)) || null,
      description: description.slice(0, 20000) || null,
      posted_at: p && p.datePosted && !Number.isNaN(Date.parse(p.datePosted)) ? new Date(p.datePosted).toISOString() : null,
      valid_through: p && p.validThrough && !Number.isNaN(Date.parse(p.validThrough)) ? new Date(p.validThrough).toISOString() : null,
      closed_banner: closed ? clean(body.slice(Math.max(0, closed.index - 40), closed.index + 120)) : null,
      apply_control: description.length > 200 ? !!applyEl : null,
      posted_text: posted ? clean(posted[0]).slice(0, 120) : null,
      reposted: /\breposted\b/i.test(body),
      read_from: "page",
      looks_like_posting: looksLikePosting,
    };
  }

  window.__savantCoachRead = read;
})();
