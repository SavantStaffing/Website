import { Link, Outlet, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "./ui";

type NavItem = { to: LinkProps["to"]; label: string };

/**
 * Shared shell for the /talent, /recruiter and /admin hubs: header with the
 * signed-in email, notifications, sign out, and the section nav. The route
 * files keep their own `beforeLoad` role guards.
 */
export function HubLayout({
  eyebrow,
  email,
  userId,
  nav,
  root,
}: {
  eyebrow: string;
  email: string | null;
  userId: string;
  nav: readonly NavItem[];
  root: string;
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" } as never, replace: true });
    toast.success("Signed out.");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--color-hairline)] pb-8">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-3 truncate text-3xl font-semibold md:text-4xl">{email}</h1>
        </div>
        <div className="flex items-center gap-6">
          <Notifications userId={userId} />
          <button
            onClick={signOut}
            disabled={signingOut}
            className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground disabled:opacity-50"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="[@media(hover:hover)]:hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: n.to === root }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-12">
        <Outlet />
      </div>
    </div>
  );
}

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function Notifications({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setItems(data ?? []));
  }, [userId]);

  const unread = items.filter((n) => !n.read_at);

  async function markAllRead() {
    if (!unread.length) return;
    const now = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .in(
        "id",
        unread.map((n) => n.id),
      );
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
        aria-expanded={open}
      >
        Notifications{unread.length ? ` (${unread.length})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-3 w-[min(22rem,calc(100vw-3rem))] rounded-sm border border-[color:var(--color-hairline)] bg-background p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[color:var(--color-hairline)] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="p-3">
                  {n.link ? (
                    <Link
                      to={n.link as LinkProps["to"]}
                      onClick={() => setOpen(false)}
                      className="text-sm font-medium"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <div className="text-sm font-medium">{n.title}</div>
                  )}
                  {n.body && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
