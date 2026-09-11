import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recruiter/company")({
  head: () => ({
    meta: [{ title: "Company" }, { name: "robots", content: "noindex" }],
  }),
  component: Company,
});

function Company() {
  const { profile } = Route.useRouteContext();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile.organizationId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organizationId!)
        .maybeSingle();
      setName(data?.name ?? null);
      setLoading(false);
    })();
  }, [profile.organizationId]);

  return (
    <section>
      <h2 className="text-2xl font-semibold">Company</h2>
      {!profile.organizationId ? (
        <div className="mt-8 rounded-sm border border-[color:var(--color-hairline)] p-6">
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to an organization yet. Contact your Savant admin to be
            assigned to a company.
          </p>
        </div>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 rounded-sm border border-[color:var(--color-hairline)] p-6">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Organization
          </div>
          <div className="mt-2 text-2xl font-medium">{name ?? "—"}</div>
        </div>
      )}
    </section>
  );
}
