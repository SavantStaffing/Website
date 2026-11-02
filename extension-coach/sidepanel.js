// Savant Coach side panel: reads the open tab (or a Google Sheet of listings), asks the
// Savant API for a Pass / No pass per listing, and shows the reasons plus a chat box.
// Everything shown that came from a web page is set with textContent, never innerHTML.
"use strict";

const feed = document.getElementById("feed");
const modeLabel = document.getElementById("mode");
const form = document.getElementById("composer");
const askInput = document.getElementById("ask");
const sendBtn = document.getElementById("send");

const SAVANT = "https://savantalent.com";
const BATCH = 8; // listings per API call
const MAX_ROWS = 200; // per sheet run

const state = {
  run: 0, // bumped on every refresh so slow answers for an old tab are dropped
  view: "loading", // loading | signedout | msg | perm | notposting | page | sheet
  msg: "",
  tab: null,
  page: null, // { item, entry } for the open posting
  sheet: null, // { id, gid, items, cols, error }
  results: [], // sheet check results
  running: false,
  stop: false,
  checkRun: 0, // bumped when a sheet run starts or the context changes, to end an old run
  context: "",
  progress: "",
  filter: "all",
  paste: "",
  chat: [], // { role: "user" | "assistant", content }
  thinking: false,
};

const send = (msg) => chrome.runtime.sendMessage(msg);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const card = (...kids) => h("section", { class: "card" }, ...kids);

// ------------------------------------------------------------------ tab + sheet helpers

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function parseSheetUrl(url) {
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/.exec(url || "");
  if (!m) return null;
  return { id: m[1], gid: /[#&?]gid=(\d+)/.exec(url)?.[1] || "0" };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Find the link column and (from the header row above the first link) title / company / location. */
function sheetItems(rows) {
  const isUrl = (s) => /^https?:\/\/\S+$/i.test((s || "").trim());
  const width = Math.max(0, ...rows.map((r) => r.length));
  let urlCol = -1;
  let best = 0;
  for (let c = 0; c < width; c++) {
    const n = rows.filter((r) => isUrl(r[c])).length;
    if (n > best) { best = n; urlCol = c; }
  }
  if (urlCol < 0) return { items: [], cols: null };
  const first = rows.findIndex((r) => isUrl(r[urlCol]));
  const header = first > 0 ? rows[first - 1] : [];
  const col = (re) => header.findIndex((x) => re.test(x || ""));
  const cols = {
    url: header[urlCol] || `column ${urlCol + 1}`,
    title: col(/title|role|position|job/i),
    company: col(/company|employer|organi[sz]ation/i),
    location: col(/location|city|where/i),
  };
  const seen = new Set();
  const items = [];
  rows.forEach((r, i) => {
    const url = (r[urlCol] || "").trim();
    if (!isUrl(url) || seen.has(url) || items.length >= MAX_ROWS) return;
    seen.add(url);
    const pick = (c) => (c >= 0 && (r[c] || "").trim() ? r[c].trim().slice(0, 300) : null);
    items.push({ url, title: pick(cols.title), company: pick(cols.company), location: pick(cols.location), read_from: "sheet", row: i + 1 });
  });
  const named = (c) => (c >= 0 ? header[c] : null);
  return { items, cols: { url: cols.url, title: named(cols.title), company: named(cols.company), location: named(cols.location) } };
}

function linksFromText(text) {
  const urls = [...new Set(text.match(/https?:\/\/[^\s"'<>,]+/g) || [])].slice(0, MAX_ROWS);
  return urls.map((url) => ({ url, read_from: "sheet" }));
}

// ------------------------------------------------------------------ reading the open page

async function readTab(tab) {
  const target = (allFrames) => ({ tabId: tab.id, allFrames });
  for (const allFrames of [true, false]) {
    try {
      await chrome.scripting.executeScript({ target: target(allFrames), files: ["content.js"] });
      const out = await chrome.scripting.executeScript({ target: target(allFrames), func: () => window.__savantCoachRead?.() ?? null });
      const found = out.map((o) => o.result).filter(Boolean);
      if (!found.length) continue;
      found.sort((a, b) => Number(b.looks_like_posting) - Number(a.looks_like_posting) || (b.description || "").length - (a.description || "").length);
      return { item: found[0] };
    } catch {
      // not allowed on this page / frame: try the next option
    }
  }
  return { needsPermission: true };
}

async function allowSite(tab) {
  let origin;
  try { origin = `${new URL(tab.url).origin}/*`; } catch { return; }
  const ok = await chrome.permissions.request({ origins: [origin] });
  if (ok) refresh();
}

async function checkPage(tab, run, { force = false, anyway = false } = {}) {
  const read = await readTab(tab);
  if (run !== state.run) return;
  if (read.needsPermission) { state.view = "perm"; return render(); }
  const { looks_like_posting, ...item } = read.item;
  if (!looks_like_posting && !anyway) {
    state.page = { item, entry: null };
    state.view = "notposting";
    return render();
  }
  state.page = { item, entry: null };
  state.view = "page";
  state.progress = "Checking…";
  render();
  const res = await send({ type: "check", payload: { listings: [item], force } });
  if (run !== state.run) return;
  state.progress = "";
  if (res.signedOut) { state.view = "signedout"; return render(); }
  if (res.error) { state.page.error = res.error; return render(); }
  state.page.entry = res.results[0];
  render();
}

// ------------------------------------------------------------------ sheet mode

async function loadSheet(tab, run, sheet) {
  state.view = "sheet";
  state.sheet = { ...sheet, items: [], cols: null, error: null, loading: true };
  render();
  const res = await send({ type: "sheetcsv", id: sheet.id, gid: sheet.gid });
  if (run !== state.run) return;
  if (res.error) state.sheet = { ...sheet, items: [], cols: null, error: res.error };
  else {
    const { items, cols } = sheetItems(parseCsv(res.csv));
    state.sheet = { ...sheet, items, cols, error: null };
  }
  render();
}

async function runChecks(items) {
  if (state.running || !items.length) return;
  state.running = true;
  state.stop = false;
  const mine = ++state.checkRun;
  const live = () => mine === state.checkRun; // false once the coach moves to another page or sheet
  for (let i = 0; i < items.length && !state.stop && live(); i += BATCH) {
    state.progress = `Checking ${Math.min(i + BATCH, items.length)} of ${items.length}…`;
    render();
    const res = await send({ type: "check", payload: { listings: items.slice(i, i + BATCH) } });
    if (!live()) return;
    if (res.signedOut) { state.view = "signedout"; break; }
    if (res.error) { state.chat.push({ role: "assistant", content: res.error }); break; }
    state.results.push(...res.results);
  }
  if (!live()) return;
  state.running = false;
  state.progress = "";
  state.chat.push({ role: "assistant", content: summaryText(state.results) });
  render();
}

function summaryText(results) {
  const ok = results.filter((r) => r.result);
  const no = ok.filter((r) => r.result.verdict === "no_pass").length;
  const bad = results.length - ok.length;
  return `${ok.length} checked: ${ok.length - no} pass, ${no} no pass${bad ? `, ${bad} couldn't be checked` : ""}. Ask me why any of them failed.`;
}

function tableText(results) {
  const lines = [["Row", "Verdict", "Score", "Confidence", "Reason", "Link"].join("\t")];
  for (const r of results) {
    const v = r.result;
    lines.push([r.row ?? "", v ? (v.verdict === "pass" ? "Pass" : "No pass") : "Not checked", v?.score ?? "", v?.confidence ?? "", (v?.summary || r.error || "").replace(/\s+/g, " "), r.url].join("\t"));
  }
  return lines.join("\n");
}

// ------------------------------------------------------------------ rendering

function verdictBlock(v) {
  const pass = v.verdict === "pass";
  return h("div", { class: `verdict ${v.verdict}` },
    h("div", { class: "big" }, pass ? "PASS" : "NO PASS"),
    h("div", { class: "sub" }, pass ? (v.confidence === "low" ? "No ghost signals, but unverified" : "Safe to recommend") : "Don't recommend"));
}

function chipsFor(v) {
  const c = v.checks;
  const chips = [];
  chips.push(c.live === "unknown" ? "Hiring board: can't check" : `Hiring board: ${c.live}${c.live_source ? ` (${c.live_source})` : ""}`);
  chips.push(c.age_days == null ? "Posting date unknown" : `Posted ${c.age_days} day${c.age_days === 1 ? "" : "s"} ago`);
  chips.push(c.known_to_savant ? "Known to Savant" : "New to Savant");
  if (c.repost_count > 0) chips.push(`${c.repost_count} similar posting${c.repost_count === 1 ? "" : "s"}`);
  chips.push(c.description_read ? "Page text read" : "Page text not readable");
  chips.push(c.ai_reviewed ? "AI review done" : "AI review skipped");
  return h("div", { class: "chips" }, chips.map((t) => h("span", { class: "chip" }, t)));
}

function signalList(v) {
  if (!v.signals.length) return null;
  return h("ul", { class: "signals" }, v.signals.map((s) =>
    h("li", { class: s.severity }, s.text, s.points ? ` (+${s.points})` : "", s.evidence ? h("q", {}, s.evidence) : null)));
}

function scoreBar(v) {
  return [
    h("div", { class: `bar ${v.score >= 50 ? "high" : ""}` }, h("span", { style: `width:${v.score}%` })),
    h("div", { class: "muted" }, `Ghost score ${v.score}/100 · flagged at 50 · confidence ${v.confidence}`),
  ];
}

function viewPage() {
  const { item, entry, error } = state.page;
  const title = entry?.title || item.title || "This page";
  const company = entry?.company || item.company;
  const head = h("p", { class: "title" }, title, company ? ` · ${company}` : "");
  if (error) return [card(head, h("p", {}, error), h("div", { class: "row" }, h("button", { onclick: refresh }, "Try again")))];
  if (!entry) return [card(head, h("p", { class: "muted" }, state.progress || "Checking…"))];
  const v = entry.result;
  if (!v) return [card(head, h("p", {}, entry.error || "Could not check this page."), h("div", { class: "row" }, h("button", { onclick: () => refresh({ force: true }) }, "Try again")))];
  return [
    verdictBlock(v),
    card(head, ...scoreBar(v), h("p", {}, v.summary), signalList(v), chipsFor(v),
      h("div", { class: "row" },
        h("button", { class: "ghost", onclick: () => refresh({ force: true }) }, "Re-check"),
        h("button", { class: "ghost", onclick: () => navigator.clipboard.writeText(`${v.verdict === "pass" ? "PASS" : "NO PASS"}: ${title}${company ? ` (${company})` : ""}. ${v.summary} ${entry.url}`) }, "Copy summary"))),
  ];
}

function viewSheet() {
  const s = state.sheet;
  const out = [];
  if (!s || s.loading) return [card(h("p", { class: "muted" }, "Reading the sheet…"))];
  const intro = [h("h3", {}, "Google Sheet")];
  if (s.error) intro.push(h("p", {}, s.error));
  else if (!s.items.length) intro.push(h("p", {}, "No job links found on this tab. Paste links below, or open the tab that has them."));
  else {
    intro.push(h("p", {}, `${s.items.length} listing link${s.items.length === 1 ? "" : "s"} found${s.items.length >= MAX_ROWS ? ` (first ${MAX_ROWS})` : ""}.`));
    const named = ["title", "company", "location"].filter((k) => s.cols?.[k]).map((k) => `${k}: ${s.cols[k]}`);
    intro.push(h("p", { class: "muted" }, `Link column: ${s.cols.url}${named.length ? ` · ${named.join(" · ")}` : ""}`));
    intro.push(h("div", { class: "row" },
      h("button", { disabled: state.running, onclick: () => runChecks(s.items.filter((i) => !state.results.some((r) => r.url === i.url))) }, state.results.length ? "Check the rest" : `Check all ${s.items.length}`),
      state.running ? h("button", { class: "ghost", onclick: () => { state.stop = true; } }, "Stop") : h("button", { class: "ghost", onclick: () => refresh({ force: true }) }, "Reload sheet")));
  }
  if (state.progress) intro.push(h("p", { class: "muted" }, state.progress));
  const paste = h("textarea", { placeholder: "Or paste job links, one per line", oninput: (e) => { state.paste = e.target.value; } });
  paste.value = state.paste;
  intro.push(paste, h("div", { class: "row" }, h("button", { class: "ghost", disabled: state.running, onclick: () => runChecks(linksFromText(state.paste)) }, "Check pasted links")));
  out.push(card(...intro));
  if (state.results.length) out.push(resultsCard());
  return out;
}

function resultsCard() {
  const ok = state.results.filter((r) => r.result);
  const count = (v) => ok.filter((r) => r.result.verdict === v).length;
  const shown = state.results.filter((r) => state.filter === "all" || r.result?.verdict === state.filter);
  const chip = (key, label) => h("span", { class: `chip pick ${state.filter === key ? "on" : ""}`, onclick: () => { state.filter = key; render(); } }, label);
  return card(
    h("h3", {}, "Results"),
    h("div", { class: "chips" }, chip("all", `All ${state.results.length}`), chip("pass", `Pass ${count("pass")}`), chip("no_pass", `No pass ${count("no_pass")}`)),
    h("div", { class: "row" }, h("button", { class: "ghost", onclick: () => navigator.clipboard.writeText(tableText(state.results)) }, "Copy as table")),
    ...shown.map(resultItem));
}

function resultItem(r) {
  const v = r.result;
  const name = [r.title, r.company].filter(Boolean).join(" · ") || r.url;
  const badge = v ? h("span", { class: `badge ${v.verdict}` }, v.verdict === "pass" ? "PASS" : "NO PASS") : h("span", { class: "badge err" }, "ERROR");
  const detail = v ? h("details", {}, h("summary", { class: "muted" }, "Why"), ...scoreBar(v), signalList(v), chipsFor(v)) : null;
  return h("div", { class: "item", style: "margin-top:10px;padding-top:10px;border-top:1px solid var(--line)" },
    badge,
    h("div", {}, h("a", { href: r.url, target: "_blank", rel: "noreferrer" }, `${r.row ? `Row ${r.row} · ` : ""}${name}`)),
    h("div", { class: "why" }, v ? v.summary : r.error), detail ? h("div", { class: "why" }, detail) : null);
}

const VIEWS = {
  loading: () => [card(h("p", { class: "muted" }, "Reading this tab…"))],
  msg: () => [card(h("p", {}, state.msg))],
  signedout: () => [card(h("h3", {}, "Sign in to Savant"), h("p", {}, "Open your coach hub in this browser and sign in. Savant Coach connects automatically."),
    h("div", { class: "row" }, h("button", { onclick: () => chrome.tabs.create({ url: `${SAVANT}/coach` }) }, "Open Savant"), h("button", { class: "ghost", onclick: refresh }, "I'm signed in")))],
  perm: () => {
    let host = "this site";
    try { host = new URL(state.tab.url).hostname; } catch { /* keep default */ }
    return [card(h("h3", {}, "Allow Savant Coach on this site?"), h("p", {}, `To read the listing, Savant Coach needs permission to see ${host}. It only reads the page when this panel is open.`),
      h("div", { class: "row" }, h("button", { onclick: () => allowSite(state.tab) }, `Allow on ${host}`)))];
  },
  notposting: () => [card(h("h3", {}, "This doesn't look like a job posting"), h("p", { class: "muted" }, "Open a single job's page, or a Google Sheet of listings."),
    h("div", { class: "row" }, h("button", { class: "ghost", onclick: () => checkPage(state.tab, state.run, { anyway: true }) }, "Check this page anyway")))],
  page: viewPage,
  sheet: viewSheet,
};

function chatNodes() {
  const nodes = state.chat.map((m) => h("div", { class: `msg ${m.role === "user" ? "user" : "bot"}` }, m.content));
  if (state.thinking) nodes.push(h("div", { class: "msg bot muted" }, "Thinking…"));
  return nodes;
}

function render() {
  modeLabel.textContent = state.view === "sheet" ? "Sheet" : state.view === "page" || state.view === "notposting" ? "Listing" : "";
  const keep = feed.scrollTop;
  feed.replaceChildren(...(VIEWS[state.view] || VIEWS.msg)(), ...chatNodes());
  askInput.disabled = sendBtn.disabled = state.thinking;
  feed.scrollTop = state.chat.length ? feed.scrollHeight : keep;
}

// ------------------------------------------------------------------ chat

function chatContext() {
  const entries = state.view === "sheet" ? state.results : state.page?.entry ? [state.page.entry] : [];
  return entries.filter((r) => r.result).slice(0, 60).map((r) => ({
    row: r.row, title: r.title, company: r.company, url: r.url,
    verdict: r.result.verdict, score: r.result.score, confidence: r.result.confidence, summary: r.result.summary,
    signals: r.result.signals.map((s) => ({ severity: s.severity, text: s.text, ...(s.evidence ? { evidence: s.evidence } : {}) })),
  }));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = askInput.value.trim();
  if (!question || state.thinking) return;
  askInput.value = "";
  const context = chatContext();
  state.chat.push({ role: "user", content: question });
  if (!context.length) {
    state.chat.push({ role: "assistant", content: "Check a listing first, then I can answer questions about the results." });
    return render();
  }
  state.thinking = true;
  render();
  const history = state.chat.slice(0, -1).slice(-6).map((m) => ({ role: m.role, content: m.content }));
  const res = await send({ type: "chat", payload: { question, context, history } });
  state.thinking = false;
  if (res.signedOut) state.view = "signedout";
  state.chat.push({ role: "assistant", content: res.answer || res.error || "No answer." });
  render();
});

// ------------------------------------------------------------------ refresh on tab changes

async function refresh(opts) {
  opts = opts && typeof opts === "object" && !(opts instanceof Event) ? opts : {};
  const run = ++state.run;
  const status = await send({ type: "status" });
  if (run !== state.run) return;
  if (!status?.signedIn) { state.view = "signedout"; return render(); }
  const tab = await activeTab();
  if (run !== state.run) return;
  if (!tab?.url || !/^https?:/.test(tab.url)) { state.view = "msg"; state.msg = "Open a job listing or a Google Sheet of listings, then I'll check it."; return render(); }

  const sheet = parseSheetUrl(tab.url);
  const context = sheet ? `sheet:${sheet.id}:${sheet.gid}` : `page:${tab.url.split("#")[0]}`;
  const sameContext = context === state.context;
  if (!sameContext) { // a different page or sheet: start fresh
    state.context = context;
    state.results = [];
    state.chat = [];
    state.paste = "";
    state.filter = "all";
    state.checkRun++; // ends a run still going on the old sheet
    state.running = false;
    state.progress = "";
  }
  state.tab = tab;
  // Coming back to a tab we already checked: keep the answer. Re-check / Reload ask again.
  if (sameContext && !opts.force) {
    if (sheet && state.view === "sheet" && state.sheet && !state.sheet.error) return render();
    if (!sheet && state.view === "page" && state.page?.entry) return render();
  }
  if (sheet) return loadSheet(tab, run, sheet);
  state.view = "loading";
  render();
  return checkPage(tab, run, { force: !!opts.force });
}

let timer = null;
const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(() => refresh(), 500); };
chrome.tabs.onActivated.addListener(refreshSoon);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && (change.status === "complete" || change.url)) refreshSoon();
});
chrome.storage.onChanged.addListener((changes) => { if (changes.token) refreshSoon(); });

refresh();
