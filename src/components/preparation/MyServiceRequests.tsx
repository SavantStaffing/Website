import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Empty, SectionHeading, list, mutedButton, timeAgo } from "@/components/site/ui";
import { SERVICE_LABEL, SERVICE_STATUS_LABEL, type ServiceId } from "@/lib/services";

type Row = {
  id: string;
  service: string;
  program: string | null;
  status: string;
  created_at: string;
};

/** Talent dashboard: the Preparation services they've signed up for. */
export function MyServiceRequests({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase
      .from("service_requests")
      .select("id, service, program, status, created_at")
      .eq("talent_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [userId]);

  async function withdraw(id: string) {
    const { error } = await supabase.from("service_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? null);
  }

  return (
    <div>
      <SectionHeading title="Preparation services">
        <Link to="/preparation" className={mutedButton}>
          Browse services →
        </Link>
      </SectionHeading>
      {!rows ? null : rows.length === 0 ? (
        <Empty>
          Career programs, resume building and interview practice with a Savant career coach.{" "}
          <Link to="/preparation" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
          .
        </Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
              <div>
                <div>{SERVICE_LABEL[r.service as ServiceId] ?? r.service}</div>
                <div className="text-xs text-muted-foreground">
                  {r.program ? `${r.program} · ` : ""}signed up {timeAgo(r.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge
                  tone={
                    r.status === "completed" ? "good" : r.status === "cancelled" ? "muted" : "warn"
                  }
                >
                  {SERVICE_STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.status === "new" && (
                  <button onClick={() => withdraw(r.id)} className={mutedButton}>
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
