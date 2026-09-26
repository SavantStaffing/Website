import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Empty, SectionHeading, list, mutedButton, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [{ title: "Messages" }, { name: "robots", content: "noindex" }],
  }),
  component: Messages,
});

type Message = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: string | null;
  message: string;
  handled: boolean;
  created_at: string;
};

/** Contact-page submissions. */
function Messages() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  useEffect(() => {
    supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setMessages(data ?? []));
  }, []);

  async function setHandled(m: Message, handled: boolean) {
    const { error } = await supabase.from("contact_messages").update({ handled }).eq("id", m.id);
    if (error) return toast.error(error.message);
    setMessages((prev) => prev?.map((x) => (x.id === m.id ? { ...x, handled } : x)) ?? null);
  }

  const visible = messages?.filter((m) => showHandled || !m.handled) ?? [];

  return (
    <section>
      <SectionHeading title="Contact messages">
        <button onClick={() => setShowHandled((v) => !v)} className={mutedButton}>
          {showHandled ? "Hide handled" : "Show handled"}
        </button>
      </SectionHeading>
      {!messages ? (
        <Empty>Loading…</Empty>
      ) : visible.length === 0 ? (
        <Empty>No {showHandled ? "" : "open "}messages.</Empty>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {visible.map((m) => (
            <li key={m.id} className={`py-6 ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <span className="font-medium">{m.name}</span>{" "}
                  <a
                    href={`mailto:${m.email}`}
                    className="text-sm text-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
                  >
                    {m.email}
                  </a>
                  {m.company && (
                    <span className="text-sm text-muted-foreground"> · {m.company}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {m.topic && <Badge>{m.topic}</Badge>}
                  <span className="text-xs text-muted-foreground">{timeAgo(m.created_at)}</span>
                  <button onClick={() => setHandled(m, !m.handled)} className={mutedButton}>
                    {m.handled ? "Reopen" : "Mark handled"}
                  </button>
                </div>
              </div>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
