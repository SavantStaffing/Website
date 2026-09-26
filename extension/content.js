// Savant Apply: extract the live form -> get a fill plan -> fill -> highlight for review.
// It never clicks submit. The candidate reviews highlighted fields and submits themselves.

const registry = new Map(); // key -> { els: [HTMLElement], combobox: bool }
let lastPlan = null;

const clean = (s) => (s || "").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function labelFor(el) {
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) return clean(l.innerText);
  }
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");
    if (t.trim()) return clean(t);
  }
  if (el.getAttribute("aria-label")) return clean(el.getAttribute("aria-label"));
  const wrap = el.closest("label, .application-question, [class*='field'], [class*='question']");
  const lab = wrap?.matches("label") ? wrap : wrap?.querySelector("label, .application-label, [class*='label']");
  return clean(lab?.innerText) || el.placeholder || el.name || el.id || "";
}

function groupLabel(el) {
  const g = el.closest("fieldset, [role='radiogroup'], [role='group'], .application-question, [class*='question']");
  const l = g?.querySelector("legend, .application-label, [class*='label']:not(label)") || g?.querySelector("label");
  return clean(l?.innerText) || labelFor(el);
}

function extractFields() {
  registry.clear();
  const fields = [];
  for (const el of document.querySelectorAll("input, textarea, select")) {
    const t = (el.type || "").toLowerCase();
    if (["hidden", "submit", "button", "search", "image", "reset"].includes(t) || el.disabled) continue;
    if (!el.offsetParent && t !== "file") continue; // file inputs often hide behind a styled button
    const key = el.name || el.id;
    if (!key) continue;
    if (registry.has(key)) { registry.get(key).els.push(el); continue; } // radio / checkbox groups

    const combobox = el.getAttribute("role") === "combobox";
    const type = el.tagName === "TEXTAREA" ? "textarea"
      : el.tagName === "SELECT" || t === "radio" || combobox ? "select"
      : t === "file" ? "file"
      : t === "checkbox" ? "checkbox"
      : "text";
    const label = t === "radio" || t === "checkbox" ? groupLabel(el) : labelFor(el);
    const required = el.required || el.getAttribute("aria-required") === "true";
    registry.set(key, { els: [el], combobox });
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

async function pickCombobox(el, text) {
  // Greenhouse's new boards and Ashby use custom dropdowns: open, type, click the matching option.
  el.focus(); el.click();
  setNativeValue(el, text);
  const want = text.toLowerCase();
  const opt = await waitFor(() => [...document.querySelectorAll("[role='option']")]
    .find((o) => o.innerText.trim().toLowerCase().startsWith(want)));
  if (opt) opt.click();
  else el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
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
    ? el.closest("fieldset, [role='radiogroup'], .application-question") || el : el;
  const color = f.value == null ? (f.required ? "#e5484d" : null) : f.needs_review ? "#f5a524" : "#30a46c";
  if (!color) return;
  target.style.outline = `2px solid ${color}`;
  target.style.outlineOffset = "2px";
  target.title = f.value == null ? "Savant: needs your answer" : `Savant: filled from ${f.source.replace("_", " ")}`;
}

async function applyFill(f) {
  const r = registry.get(f.key);
  if (!r || f.source === "skipped") return;
  const el = r.els[0];
  try {
    if (f.value != null) {
      if (f.type === "file") await setFile(el, f.value, f.filename);
      else if (el.tagName === "SELECT") { el.value = f.value; fire(el, "change"); }
      else if (el.type === "radio") r.els.find((e) => e.value === f.value)?.click();
      else if (el.type === "checkbox") {
        const want = typeof f.value === "boolean" ? () => f.value : (e) => [].concat(f.value).includes(e.value);
        r.els.forEach((e) => { if (want(e) !== e.checked) e.click(); });
      }
      else if (r.combobox) await pickCombobox(el, String(f.value));
      else setNativeValue(el, String(f.value));
    }
  } catch (e) {
    console.warn("Savant: could not fill", f.key, e);
  }
  mark(el, f);
}

function currentAnswer(r) {
  const el = r.els[0];
  if (el.tagName === "SELECT") return el.selectedOptions[0]?.text?.trim() || "";
  if (el.type === "radio") { const c = r.els.find((e) => e.checked); return c ? labelFor(c) : ""; }
  if (el.tagName === "TEXTAREA" || el.type === "text") return el.value.trim();
  return "";
}

let reported = false;
function reportAnswers() {
  if (!lastPlan || reported) return;
  reported = true;
  const answers = lastPlan.fills
    .filter((f) => f.source !== "profile" && f.source !== "skipped" && f.section !== "eeo" && f.type !== "file")
    .map((f) => ({ label: f.label, answer: registry.get(f.key) ? currentAnswer(registry.get(f.key)) : "" }))
    .filter((a) => a.answer);
  chrome.runtime.sendMessage({ type: "answers", payload: { job_url: location.href, answers } });
}
document.addEventListener("submit", reportAnswers, true);
document.addEventListener("click", (e) => {
  if (e.target.closest("button[type='submit'], input[type='submit'], [data-qa='btn-submit']")) reportAnswers();
}, true);

// Floating trigger button
const btn = document.createElement("button");
btn.textContent = "Autofill with Savant";
Object.assign(btn.style, {
  position: "fixed", right: "20px", bottom: "20px", zIndex: 2147483647, padding: "10px 16px",
  borderRadius: "8px", border: "none", background: "#1a1714", color: "#fff",
  font: "600 14px system-ui, sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,.2)", cursor: "pointer",
});
document.body.appendChild(btn);

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Filling…";
  const fields = extractFields();
  if (!fields.length) { btn.textContent = "No form found — open the Apply step"; btn.disabled = false; return; }
  const jd = document.querySelector("#content, .posting-page, .job__description, [class*='description']")
    ?.innerText?.slice(0, 8000);
  const plan = await chrome.runtime.sendMessage({
    type: "plan", payload: { job_url: location.href, fields, job_description: jd || null },
  });
  if (!plan || plan.error) { btn.textContent = plan?.error || "Something went wrong"; btn.disabled = false; return; }
  lastPlan = plan;
  reported = false;
  for (const f of plan.fills) await applyFill(f);
  const review = plan.fills.filter((f) => f.value != null && f.needs_review).length;
  const missing = plan.unresolved_required.length;
  btn.textContent = `Review ${review} amber · answer ${missing} red · then submit`;
  btn.disabled = false;
});
