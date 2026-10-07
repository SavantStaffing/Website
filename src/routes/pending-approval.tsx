import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Where a recruiter lands after signing up, until an admin approves the
 * account (recruiter_requests). Approved or not a recruiter: on to the dashboard.
 */
export const Route = createFileRoute("/pending-approval")({
  ssr: false,
  beforeLoad: async () => {
    const ctx = await requireAuth();
    if (!ctx.approval) throw redirect({ to: "/dashboard", replace: true });
    return { approval: ctx.approval };
  },
  head: () => ({
    meta: [
      { title: "Account pending approval — Savant Staffing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingApproval,
});

function PendingApproval() {
  const { approval } = Route.useRouteContext();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const declined = approval === "declined";

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-6 py-24 text-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Recruiter account
        </p>
        <h1 className="mt-4 text-3xl font-semibold">
          {declined ? "Your account wasn't approved." : "Your account is waiting for approval."}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {declined
            ? "We weren't able to approve this recruiter account. If you think that's a mistake, get in touch and we'll take another look."
            : "Thanks for signing up. A Savant admin reviews every recruiter account before it can see talent or post jobs. We'll let you know as soon as yours is approved, usually within one business day."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <Link
            to="/contact"
            className="border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em]"
          >
            Contact us
          </Link>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
