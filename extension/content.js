// Savant Apply: extract the live form -> get a fill plan -> fill -> highlight for review.
// It never clicks submit. The candidate reviews highlighted fields and submits themselves.
//
// Runs two ways:
// - on Greenhouse, Lever, Ashby and Workday pages (content_scripts in the manifest),
//   with a floating "Autofill with Savant" button;
// - on any other page, only when the talent clicks the Savant toolbar icon
//   there (activeTab): background.js injects this file and calls fill().
(() => {
  if (window.__savantApply) return; // already loaded in this page
  window.__savantApply = { fill: () => run({ all: true }) };

  const WORKDAY = /\.myworkday(jobs|site)\.com$/.test(location.hostname);
  const registry = new Map(); // key -> { els: [HTMLElement], kind: "native" | "combobox" | "listbox" }
  const filled = new WeakSet(); // elements already part of a plan
  let pending = []; // fills on the current step, not yet reported back
  let planned = false; // a fill has run on this page
  let submitted = false;
  let keySeq = 0;

  const clean = (s) => (s || "").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!(el.offsetParent || el.getClientRects().length);
  const SKIP_TYPES = ["hidden", "submit", "button", "search", "image", "reset", "password"];

  function rawLabelFor(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.innerText;
    }
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");
      if (t.trim()) return t;
    }
    // Workday dropdowns: "How Did You Hear About Us? select one required".
    if (el.getAttribute("aria-label"))
      return el.getAttribute("aria-label").replace(/\s+(select one|required)\b/gi, "");
    const wrap = el.closest("label, .application-question, [class*='field'], [class*='question'], [data-automation-id^='formField']");
    const lab = wrap?.matches("label") ? wrap : wrap?.querySelector("label, legend, .application-label, [class*='label']");
    return lab?.innerText || el.placeholder || el.name || el.id || "";
  }
  const labelFor = (el) => clean(rawLabelFor(el));

  function groupLabel(el) {
    const g = el.closest("fieldset, [role='radiogroup'], [role='group'], .application-question, [class*='question']");
    const l = g?.querySelector("legend, .application-label, [class*='label']:not(label)") || g?.querySelector("label");
    return clean(l?.innerText) || labelFor(el);
  }

  // A file input usually hides behind a styled button; name it from its section ("Resume/CV").
  function fileLabel(el) {
    const own = labelFor(el);
    if (own && own !== el.name && own !== el.id) return own;
    const box = el.parentElement?.closest("section, fieldset, [data-automation-id], [class*='upload'], [class*='field']");
    return clean((box?.innerText || "").slice(0, 120)) || "Resume";
  }

  function keyOf(el) {
    if (el.name || el.id) return el.name || el.id;
    if (!el.dataset.savantKey) el.dataset.savantKey = `${el.getAttribute("data-automation-id") || "field"}~${keySeq++}`;
    return el.dataset.savantKey;
  }

  /** Inputs Savant could fill, plus Workday's dropdowns (buttons that open a listbox). */
  function fillable() {
    return [
      ...document.querySelectorAll("input, textarea, select"),
      ...document.querySelectorAll("button[aria-haspopup='listbox']"),
    ].filter((el) => {
      if (el.closest("#savant-apply-button") || el.disabled || el.readOnly) return false;
      if (el.getAttribute("role") === "spinbutton") return false; // date parts
      const t = (el.type || "").toLowerCase();
      if (el.tagName !== "BUTTON" && SKIP_TYPES.includes(t)) return false;
      return t === "file" || visible(el);
    });
  }

  const hasPassword = () => [...document.querySelectorAll("input[type='password']")].some(visible);

  /** Fields on the page; with onlyNew, those not already part of an earlier plan. */
  function extractFields({ onlyNew = false } = {}) {
    if (!onlyNew) registry.clear();
    const fields = [];
    const seen = new Map();
    for (const el of fillable()) {
      if (onlyNew && filled.has(el)) continue;
      const t = (el.type || "").toLowerCase();
      const key = keyOf(el);
      if (seen.has(key)) { seen.get(key).els.push(el); continue; } // radio / checkbox groups

      const kind = el.tagName === "BUTTON" ? "listbox"
        : el.getAttribute("role") === "combobox" || el.getAttribute("data-uxi-widget-type") === "selectinput" ? "combobox"
        : "native";
      const type = el.tagName === "TEXTAREA" ? "textarea"
        : el.tagName === "SELECT" || t === "radio" || kind !== "native" ? "select"
        : t === "file" ? "file"
        : t === "checkbox" ? "checkbox"
        : "text";
      const group = t === "radio" || t === "checkbox";
      const raw = group ? "" : rawLabelFor(el);
      const label = group ? groupLabel(el) : t === "file" ? fileLabel(el) : clean(raw);
      const required = el.required || el.getAttribute("aria-required") === "true" || /\*\s*$/.test(raw);
      const entry = { els: [el], kind };
      seen.set(key, entry);
      registry.set(key, entry);
      fields.push({ key, label, type, required });
    }
    for (const f of fields) {
      const { els } = registry.get(f.key);
      const first = els[0];
      if (first.tagName === "SELECT") {
        f.options = [...first.options].filter((o) => o.value).map((o) => ({ label: o.text.trim(), value: o.value }));
      } else if (first.type === "radio" || (first.type === "checkbox" && els.length > 1)) {
        if (first.type === "checkbox") f.type = "multiselect";
        f.options = els.map((e) => ({ label: labelFor(e), value: e.value }));
      }
    }
    return fields;
  }

  function setNativeValue(el, value) {
    // React/Vue forms ignore el.value = x; call the prototype setter, then emit events.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    fire(el, "input"); fire(el, "change"); fire(el, "blur");
  }

  async function waitFor(fn, ms = 1500) {
    for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await sleep(100); }
    return null;
  }

  const findOption = (want) => waitFor(() => [...document.querySelectorAll("[role='option']")]
    .filter(visible)
    .find((o) => o.innerText.trim().toLowerCase().startsWith(want)));

  async function pickCombobox(el, text) {
    // Greenhouse's new boards, Ashby and Workday prompts: open, type, click the matching option.
    el.focus(); el.click();
    setNativeValue(el, text);
    const opt = await findOption(text.toLowerCase());
    if (opt) opt.click();
    else el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  async function pickListbox(button, text) {
    // Workday: the button opens a list of options; click the one that matches.
    button.click();
    const opt = await findOption(text.toLowerCase());
    if (opt) opt.click();
    else button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  async function setFile(input, url, filename) {
    const res = await chrome.runtime.sendMessage({ type: "file", url });
    if (!res?.b64) return false;
    const bytes = Uint8Array.from(atob(res.b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], filename || "resume.pdf", { type: res.mime || "application/pdf" }));
    input.files = dt.files;
    fire(input, "input"); fire(input, "change");
    return true;
  }

  function mark(el, f) {
    const target = el.type === "radio" || el.type === "checkbox"
      ? el.closest("fieldset, [role='radiogroup'], .application-question") || el
      : el.type === "file" ? el.parentElement?.closest("section, [data-automation-id], [class*='upload'], [class*='field']") || el
      : el;
    const color = f.value == null ? (f.required ? "#e5484d" : null) : f.needs_review ? "#f5a524" : "#30a46c";
    if (!color) return;
    target.style.outline = `2px solid ${color}`;
    target.style.outlineOffset = "2px";
    target.title = f.value == null ? "Savant: needs your answer" : `Savant: filled from ${f.source.replace("_", " ")}`;
  }

  /** What the field holds now ("" when empty or still on its placeholder choice). */
  function currentAnswer(r) {
    const el = r.els[0];
    if (!el.isConnected) return "";
    if (el.tagName === "SELECT") return el.value ? el.selectedOptions[0]?.text?.trim() || "" : "";
    if (el.tagName === "BUTTON") { const t = el.innerText.trim(); return /^select one$/i.test(t) ? "" : t; }
    if (el.type === "radio") { const c = r.els.find((e) => e.checked); return c ? labelFor(c) : ""; }
    if (el.tagName === "TEXTAREA" || ["text", "email", "tel", "url", "number", ""].includes(el.type)) return el.value.trim();
    return "";
  }

  async function applyFill(f) {
    const r = registry.get(f.key);
    if (!r || f.source === "skipped") return;
    const el = r.els[0];
    try {
      // Never overwrite something the talent already typed or chose.
      if (f.value != null && !currentAnswer(r)) {
        if (f.type === "file") await setFile(el, f.value, f.filename);
        else if (r.kind === "listbox") await pickListbox(el, String(f.value));
        else if (el.tagName === "SELECT") { el.value = f.value; fire(el, "change"); }
        else if (el.type === "radio") r.els.find((e) => e.value === f.value)?.click();
        else if (el.type === "checkbox") {
          const want = typeof f.value === "boolean" ? () => f.value : (e) => [].concat(f.value).includes(e.value);
          r.els.forEach((e) => { if (want(e) !== e.checked) e.click(); });
        }
        else if (r.kind === "combobox") await pickCombobox(el, String(f.value));
        else setNativeValue(el, String(f.value));
      }
    } catch (e) {
      console.warn("Savant: could not fill", f.key, e);
    }
    mark(el, f);
  }

  // ------------------------------------------------------------ saving answers

  // The posting's address without the apply-flow suffix, so Savant can match the job.
  const jobUrl = () =>
    location.origin + location.pathname.replace(/\/apply(\/[\w-]*)?\/?$/, "") + location.search;

  /**
   * Send the answers on the current step so they're saved for next time.
   * `final` marks the application as sent. Multi-step forms (Workday) report
   * each step as the talent leaves it, before the page swaps it out.
   */
  function report(final) {
    const answers = pending
      .filter((f) => f.source !== "profile" && f.source !== "skipped" && f.section !== "eeo" && f.type !== "file")
      .map((f) => ({ label: f.label, answer: f.entry ? currentAnswer(f.entry) : "" }))
      .filter((a) => a.answer);
    pending = [];
    if (final) submitted = true;
    else if (!answers.length) return;
    chrome.runtime.sendMessage({ type: "answers", payload: { job_url: jobUrl(), answers, submitted: final } });
  }

  const STEP = /^(next|continue|save (and|&) continue|next step)$/i;
  const FINAL = /submit|send application/i;
  let stepClickAt = 0;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button, input[type='submit'], [role='button']");
    if (!b || b.id === "savant-apply-button" || !planned || submitted) return;
    const text = (b.innerText || b.value || "").trim();
    if (STEP.test(text)) { stepClickAt = Date.now(); report(false); }
    else if (FINAL.test(text) || b.matches("[data-qa='btn-submit']")) report(true);
  }, true);
  document.addEventListener("submit", () => {
    if (planned && !submitted && Date.now() - stepClickAt > 1000) report(true);
  }, true);

  // ------------------------------------------------------------ filling

  const btn = document.createElement("button");
  btn.id = "savant-apply-button";
  btn.type = "button";
  btn.textContent = "Autofill with Savant";
  Object.assign(btn.style, {
    position: "fixed", right: "20px", bottom: "20px", zIndex: 2147483647, padding: "10px 16px",
    borderRadius: "8px", border: "none", background: "#1a1714", color: "#fff",
    font: "600 14px system-ui, sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,.2)", cursor: "pointer",
  });
  document.body.appendChild(btn);

  let busy = false;
  let watching = false;

  /** Fill the form: every field (all), or only fields that appeared since the last fill. */
  async function run({ all }) {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = "Filling…";
    try {
      const fields = extractFields({ onlyNew: !all });
      if (!fields.length) {
        btn.textContent = WORKDAY ? "Open the application, then try again" : "No form found — open the Apply step";
        return;
      }
      const jd = document.querySelector("#content, .posting-page, .job__description, [data-automation-id='jobPostingDescription'], [class*='description']")
        ?.innerText?.slice(0, 8000);
      const plan = await chrome.runtime.sendMessage({
        type: "plan", payload: { job_url: jobUrl(), fields, job_description: jd || null },
      });
      if (!plan || plan.error) { btn.textContent = plan?.error || "Something went wrong"; return; }
      planned = true;
      for (const f of plan.fills) {
        const entry = registry.get(f.key);
        if (entry) entry.els.forEach((e) => filled.add(e));
        pending.push({ ...f, entry });
        await applyFill(f);
      }
      const review = plan.fills.filter((f) => f.value != null && f.needs_review).length;
      const missing = plan.unresolved_required.length;
      btn.textContent = `Review ${review} amber · answer ${missing} red · then ${WORKDAY ? "continue" : "submit"}`;
      watchSteps();
    } catch (e) {
      btn.textContent = "Something went wrong";
      console.warn("Savant:", e);
    } finally {
      busy = false;
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", () => run({ all: true }));

  /**
   * After a fill, multi-step forms (Workday's "Save and Continue") show new
   * fields without reloading. Fill each new step as it appears; fields the
   * talent already answered are left alone.
   */
  function watchSteps() {
    if (watching) return;
    watching = true;
    const stopAt = Date.now() + 30 * 60_000;
    const timer = setInterval(() => {
      if (Date.now() > stopAt || submitted) return clearInterval(timer);
      if (busy || hasPassword()) return;
      if (fillable().filter((el) => !filled.has(el)).length >= 2) run({ all: false });
    }, 1500);
  }

  // Opened from Savant with "Autofill & continue" (the site adds #savant-autofill):
  // fill once the form appears. Workday asks the talent to sign in first, so
  // the request is remembered for this tab and waits out any sign-in page.
  // Still never submits.
  const PENDING_KEY = "savant-autofill-pending";
  const requestedAt = () => {
    try { return Number(sessionStorage.getItem(PENDING_KEY)) || 0; } catch { return 0; }
  };
  const clearRequest = () => {
    try { sessionStorage.removeItem(PENDING_KEY); } catch {}
  };
  if (location.hash.includes("savant-autofill")) {
    try { sessionStorage.setItem(PENDING_KEY, String(Date.now())); } catch {}
    // Drop the marker so the URL reported on submit matches the posting.
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (requestedAt() && Date.now() - requestedAt() < 30 * 60_000) {
    const timer = setInterval(() => {
      if (!requestedAt() || Date.now() - requestedAt() > 30 * 60_000) { clearRequest(); return clearInterval(timer); }
      if (busy || hasPassword()) return;
      if (extractFields().length >= 3) {
        clearRequest();
        clearInterval(timer);
        run({ all: true });
      }
    }, 1000);
  }
})();
