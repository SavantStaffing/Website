import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty, SectionHeading, label, list, mutedButton, primaryButton, timeAgo } from "./ui";

/**
 * One-to-one chat between accounts. Who may start a conversation with whom is
 * enforced in the database (supabase/migrations/20261007000001_chat.sql):
 * admin -> anyone, coach -> talent, recruiter -> talent visible to recruiters
 * or assigned to them, talent -> coaches. Talent reply to recruiters once the
 * recruiter has written first.
 */

type Conversation = {
  id: string;
  other_id: string;
  other_name: string;
  other_role: string | null;
  last_message: string | null;
  last_sender_is_me: boolean | null;
  last_message_at: string;
  unread: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type Contact = { id: string; name: string; role: string | null; detail: string | null };

const ROLE_LABEL: Record<string, string> = {
  admin: "Savant team",
  career_coach: "Career coach",
  recruiter: "Recruiter",
  talent: "Talent",
};

/** What each kind of account can start, shown above the contact search. */
const WHO_CAN_START: Record<string, string> = {
  admin: "You can message anyone on Savant.",
  coach: "You can message any talent.",
  recruiter: "You can message talent who are visible to recruiters, and talent assigned to you.",
  talent:
    "You can message career coaches. Recruiters can message you, and you can reply once they have.",
};

type Hub = "admin" | "coach" | "recruiter" | "talent";

export function Chat({
  userId,
  hub,
  conversationId,
  startWith,
  onOpen,
}: {
  userId: string;
  hub: Hub;
  /** Open conversation (from the URL, ?c=). */
  conversationId?: string;
  /** Start a conversation with this person (from the URL, ?to=). */
  startWith?: string;
  /** Called to change the open conversation in the URL. */
  onOpen: (conversationId: string | undefined) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftTo, setDraftTo] = useState<Contact | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const open = useMemo(
    () => conversations?.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_conversations");
    if (error) return toast.error(error.message);
    setConversations((data ?? []) as Conversation[]);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return toast.error(error.message);
    setMessages((data ?? []) as Message[]);
    await supabase.rpc("mark_conversation_read", { _conversation: id });
    setConversations((prev) => prev?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) ?? prev);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    setMessages([]);
    if (conversationId) {
      setDraftTo(null);
      void loadMessages(conversationId);
    }
  }, [conversationId, loadMessages]);

  // ?to=<user>: open their existing conversation, or a new draft to them.
  useEffect(() => {
    if (!startWith || !conversations) return;
    const existing = conversations.find((c) => c.other_id === startWith);
    if (existing) return onOpen(existing.id);
    supabase.rpc("chat_contacts").then(({ data }) => {
      const c = ((data ?? []) as Contact[]).find((x) => x.id === startWith);
      if (c) {
        setDraftTo(c);
        onOpen(undefined);
      } else toast.error("You can't start a conversation with this person.");
    });
    // Only when the ?to= target or the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWith, conversations === null]);

  // Live updates: new messages in any of my conversations (row-level security
  // limits the stream to them). A slow poll covers dropped connections.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        (payload) => {
          const m = payload.new as Message;
          if (m.conversation_id === conversationId) {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            if (m.sender_id !== userId)
              void supabase.rpc("mark_conversation_read", { _conversation: m.conversation_id });
          }
          void loadConversations();
        },
      )
      .subscribe();
    const poll = window.setInterval(() => {
      void loadConversations();
      if (conversationId) void loadMessages(conversationId);
    }, 30_000);
    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [userId, conversationId, loadConversations, loadMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversationId]);

  // Contact search for "New message".
  useEffect(() => {
    if (!picking) return;
    const t = window.setTimeout(() => {
      supabase.rpc("chat_contacts", { _q: query.trim() || null }).then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setContacts((data ?? []) as Contact[]);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [picking, query]);

  function choose(c: Contact) {
    setPicking(false);
    setQuery("");
    const existing = conversations?.find((x) => x.other_id === c.id);
    if (existing) return onOpen(existing.id);
    setDraftTo(c);
    onOpen(undefined);
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    if (draftTo) {
      const { data, error } = await supabase.rpc("start_conversation", {
        _other: draftTo.id,
        _body: text,
      });
      setSending(false);
      if (error) return toast.error(error.message);
      setBody("");
      setDraftTo(null);
      await loadConversations();
      onOpen(data as string);
      return;
    }
    if (!conversationId) return setSending(false);
    const { error } = await supabase.rpc("send_chat_message", {
      _conversation: conversationId,
      _body: text,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    void loadMessages(conversationId);
    void loadConversations();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter makes a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  const threadOpen = !!(open || draftTo);
  const partner = open ? { name: open.other_name, role: open.other_role } : draftTo;

  return (
    <section>
      <SectionHeading title="Chat">
        <button onClick={() => setPicking((p) => !p)} className={mutedButton}>
          {picking ? "Cancel" : "New message"}
        </button>
      </SectionHeading>

      {picking && (
        <div className="mt-6 border border-[color:var(--color-hairline)] p-5">
          <p className="text-sm text-muted-foreground">{WHO_CAN_START[hub]}</p>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            aria-label="Search people"
            className="mt-4 w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-sm outline-none focus:border-foreground"
          />
          {!contacts ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No one matches.</p>
          ) : (
            <ul className={`mt-4 max-h-72 overflow-y-auto ${list}`}>
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => choose(c)}
                    className="flex w-full items-baseline justify-between gap-4 py-3 text-left [@media(hover:hover)]:hover:bg-muted/40"
                  >
                    <span className="text-sm">
                      {c.name}
                      {c.detail && <span className="text-muted-foreground"> · {c.detail}</span>}
                    </span>
                    <span className={label}>{ROLE_LABEL[c.role ?? ""] ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Conversation list (hidden on phones while a thread is open) */}
        <div className={threadOpen ? "hidden md:block" : ""}>
          {!conversations ? (
            <Empty>Loading…</Empty>
          ) : conversations.length === 0 ? (
            <Empty>
              No conversations yet.{" "}
              {hub === "talent"
                ? "Message a career coach with New message. Recruiters will appear here when they contact you."
                : "Start one with New message."}
            </Empty>
          ) : (
            <ul className={list}>
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onOpen(c.id)}
                    aria-current={c.id === conversationId ? "true" : undefined}
                    className={`w-full py-4 pl-3 text-left ${c.id === conversationId ? "border-l-2 border-foreground" : "border-l-2 border-transparent"} [@media(hover:hover)]:hover:bg-muted/40`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-sm ${c.unread ? "font-semibold" : ""}`}>
                        {c.other_name}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {ROLE_LABEL[c.other_role ?? ""] ?? ""}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.last_sender_is_me ? "You: " : ""}
                        {c.last_message}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-foreground px-1.5 text-[10px] text-background">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className={threadOpen ? "" : "hidden md:block"}>
          {!threadOpen ? (
            <Empty>Choose a conversation.</Empty>
          ) : (
            <div className="flex h-[min(70vh,40rem)] flex-col border border-[color:var(--color-hairline)]">
              <div className="flex items-center gap-3 border-b border-[color:var(--color-hairline)] px-4 py-3">
                <button
                  onClick={() => {
                    setDraftTo(null);
                    onOpen(undefined);
                  }}
                  className={`md:hidden ${mutedButton}`}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{partner?.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {ROLE_LABEL[partner?.role ?? ""] ?? ""}
                  </div>
                </div>
              </div>

              <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                {draftTo && (
                  <li className="text-center text-xs text-muted-foreground">
                    New conversation with {draftTo.name}
                  </li>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-sm px-3 py-2 text-sm ${mine ? "bg-foreground text-background" : "border border-[color:var(--color-hairline)]"}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${mine ? "text-background/70" : "text-muted-foreground"}`}
                        >
                          {new Date(m.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
                <div ref={bottom} />
              </ol>

              <form
                onSubmit={send}
                className="flex items-end gap-3 border-t border-[color:var(--color-hairline)] p-3"
              >
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={onKey}
                  rows={2}
                  maxLength={4000}
                  placeholder="Write a message"
                  aria-label="Message"
                  className="min-h-[2.75rem] flex-1 resize-none bg-transparent text-sm outline-none"
                />
                <button type="submit" disabled={sending || !body.trim()} className={primaryButton}>
                  {sending ? "…" : "Send"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

