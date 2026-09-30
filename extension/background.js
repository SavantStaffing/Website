// All network calls go through the service worker: host_permissions let it skip page CORS.
// Point this at the deployed Savant site (no trailing slash).
const API = "https://savantalent.com";

// Messages from the Savant site (see src/lib/autofill/extension.ts):
// - "ping": lets the site show whether Savant Apply is installed, and whether
//   it's connected to the talent's account.
// - "session": the signed-in talent's Supabase access token, pushed on sign-in
//   and on every refresh.
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

// Toolbar icon: open the Savant Apply page (status, how it works, help).
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: `${API}/autofill` }));

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// The only files the extension downloads: the talent's résumé, served from
// Savant's file storage through a short-lived signed link.
function isResumeLink(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.startsWith("/storage/v1/object/sign/")
    );
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  (async () => {
    try {
      if (msg.type === "file") {
        if (!isResumeLink(msg.url)) return send({ error: "Not a Savant résumé link" });
        const r = await fetch(msg.url);
        if (!r.ok) return send({ error: `File ${r.status}` });
        return send({ b64: toBase64(await r.arrayBuffer()), mime: r.headers.get("content-type") });
      }
      const { token } = await chrome.storage.local.get("token");
      if (!token) return send({ error: "Sign in to Savant first" });
      const path = { plan: "/api/autofill/plan", answers: "/api/autofill/answers" }[msg.type];
      if (!path) return send({ error: `Unknown message ${msg.type}` });
      const r = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(msg.payload),
      });
      send(r.ok ? await r.json() : { error: r.status === 401 ? "Sign in to Savant again" : `API ${r.status}` });
    } catch (e) {
      send({ error: String(e) });
    }
  })();
  return true; // keep the channel open for the async reply
});
