import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import architectureHtml from "@/assets/architecture.html?raw";

export const Route = createFileRoute("/admin/architecture")({
  head: () => ({
    meta: [{ title: "Architecture" }, { name: "robots", content: "noindex" }],
  }),
  component: Architecture,
});

// The page is a standalone document with its own styles, so it renders in an
// iframe to keep its CSS from leaking into the site. data-theme="light" pins
// it to the site's light palette instead of following the OS dark mode.
const SRC_DOC = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${architectureHtml}</body></html>`;

/**
 * Platform architecture overview: feed data sources, security layers and each
 * role's access. Admin-only via the /admin route guard. To update it, edit
 * src/assets/architecture.html.
 */
function Architecture() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1200);

  const fit = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (doc) setHeight(doc.documentElement.scrollHeight);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  return (
    <iframe
      ref={frame}
      title="Savant platform architecture"
      srcDoc={SRC_DOC}
      onLoad={() => {
        fit();
        // Web fonts load after the document and can change its height.
        frame.current?.contentDocument?.fonts?.ready.then(fit);
      }}
      style={{ height }}
      className="block w-full border-0"
    />
  );
}
