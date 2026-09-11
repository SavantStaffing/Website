import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDashboardPath } from "@/lib/auth/session";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [{ title: "Forbidden — Savant Staffing" }, { name: "robots", content: "noindex" }],
  }),
  component: Forbidden,
});

function Forbidden() {
  const { auth } = useAuth();

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6 text-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">403</p>
        <h1 className="mt-4 text-3xl font-semibold">You don't have access to that.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This page belongs to a different account type.
        </p>
        <div className="mt-8">
          <Link
            to={auth ? getDashboardPath(auth.role) : "/"}
            className="border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em]"
          >
            {auth ? "Back to your dashboard" : "Return home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
