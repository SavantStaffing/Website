// Savant Coach service worker. All network calls go through here.
// Point API at the deployed Savant site (no trailing slash).
const API = "https://savantalent.com";

// Open the side panel when the toolbar icon is clicked.
function setup() {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

// Messages from the Savant site (src/lib/autofill/extensionBridge.ts):
// - "ping": lets the site show whether Savant Coach is installed and connected.
// - "session": the signed-in coach's Supabase access token, pushed on sign-in and every refresh.
chrome.runtime.onMessageExternal.addListener((msg, _sender, send) => {
  if (msg?.type === "ping") {
    chrome.storage.local.get("token").then(({ token }) =>
      send({ ok: true, version: chrome.runtime.getManifest().version, connected: !!token }),
    );
    return true;
  }
  if (msg?.type === "session") {
    const done = () => send({ ok: true });
    if (msg.token) chrome.storage.local.set({ token: msg.token }).then(done);
    else chrome.storage.local.remove("token").then(done);
    return true;
  }
});

async function api(path, payload) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return { error: "Sign in to Savant in this browser first", signedOut: true };
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (r.ok) return r.json();
  if (r.status === 401) return { error: "Sign in to Savant again", signedOut: true };
  const body = await r.json().catch(() => null);
  return { error: body?.error || `API ${r.status}` };
}

// A Google Sheet tab as CSV, using the coach's own Google sign-in (cookies), so no
// extra Google permission or OAuth setup is needed. Cell text only: a link hidden
// behind a label does not survive the export.
async function sheetCsv(id, gid) {
  if (!/^[\w-]{20,}$/.test(id) || !/^\d+$/.test(gid)) return { error: "Not a Google Sheet link" };
  const r = await fetch(
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
    { credentials: "include" },
  );
  const type = r.headers.get("content-type") || "";
  if (!r.ok || type.includes("text/html"))
    return { error: "Can't read this sheet. Check that you're signed in to Google and can view it." };
  return { csv: await r.text() };
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  (async () => {
    try {
      if (msg.type === "status") {
        const { token } = await chrome.storage.local.get("token");
        return send({ signedIn: !!token, version: chrome.runtime.getManifest().version });
      }
      if (msg.type === "check") return send(await api("/api/coach/check", msg.payload));
      if (msg.type === "chat") return send(await api("/api/coach/chat", msg.payload));
      if (msg.type === "sheetcsv") return send(await sheetCsv(msg.id, msg.gid));
      send({ error: `Unknown message ${msg.type}` });
    } catch (e) {
      send({ error: String(e) });
    }
  })();
  return true; // keep the channel open for the async reply
});
