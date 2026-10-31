import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, outlineButton, timeAgo } from "@/components/site/ui";
export const Route=createFileRoute("/talent/tasks")({head:()=>({meta:[{title:"Tasks | Savant"}]}),component:Tasks});
const LABELS:Record<string,string>={build_workspace:"Build Workspace",independent_research:"Independent Research",internships:"Internships",follow_up:"Follow up"};
type Task={id:string;action:string;employer:string|null;note:string|null;status:string;created_at:string};
function Tasks(){
 const {userId}=Route.useRouteContext();
 const [rows,setRows]=useState<Task[]>([]);
 const [profile,setProfile]=useState<{first_name:string|null;resume_text:string|null}|null>(null);
 const [intake,setIntake]=useState<string|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const load=async()=>{
  const [a,b,c]=await Promise.all([
   (supabase as any).from("coach_recommendations").select("id,action,employer,note,status,created_at").eq("talent_id",userId).in("status",["accepted","completed"]).order("created_at",{ascending:false}),
   supabase.from("talent_profiles").select("first_name,resume_text").eq("user_id",userId).maybeSingle(),
   supabase.from("talent_preferences").select("intake_completed_at").eq("user_id",userId).maybeSingle()
  ]);
  if(a.error) toast.error(a.error.message);
  setRows(a.data??[]);setProfile(b.data);setIntake(c.data?.intake_completed_at??null);
 };
 useEffect(()=>{void load()},[userId]);
 async function complete(t:Task){
  setBusy(t.id);
  const {error}=await (supabase as any).from("coach_recommendations").update({status:t.status==="completed"?"accepted":"completed"}).eq("id",t.id);
  setBusy(null);if(error)return toast.error(error.message);void load();
 }
 const setup=[{label:"Complete your talent profile",done:!!profile?.first_name&&!!profile?.resume_text,to:"/talent/profile" as const},{label:"Complete your career intake",done:!!intake,to:"/talent/intake" as const}];
 return <section className="space-y-12"><div><h2 className="text-2xl font-semibold">Tasks</h2><p className="mt-2 text-sm text-muted-foreground">Your onboarding checklist and the actions you accepted from your coach.</p></div>
 <div><SectionHeading title="Account setup"/><div className="mt-4 space-y-3">{setup.map(s=><div key={s.label} className="flex items-center justify-between gap-4 rounded-sm border border-[color:var(--color-hairline)] p-4"><div><span className="mr-3">{s.done?"✓":"○"}</span><span className={s.done?"line-through text-muted-foreground":""}>{s.label}</span></div>{!s.done&&<Link to={s.to} className={outlineButton}>Continue →</Link>}</div>)}</div></div>
 <div><SectionHeading title="Coach-assigned tasks"/>{rows.length===0?<p className="mt-4 text-sm text-muted-foreground">Accept a recommendation on your Coach page to add a task.</p>:<div className="mt-4 space-y-3">{rows.map(r=><div key={r.id} className="flex items-start gap-4 rounded-sm border border-[color:var(--color-hairline)] p-4"><input type="checkbox" aria-label={`Complete ${LABELS[r.action]??r.action}`} checked={r.status==="completed"} disabled={busy===r.id} onChange={()=>void complete(r)} className="mt-1 size-4"/><div><p className={r.status==="completed"?"line-through text-muted-foreground":"font-medium"}>{LABELS[r.action]??r.action}{r.employer?" — "+r.employer:""}</p>{r.note&&<p className="mt-1 text-sm text-muted-foreground">{r.note}</p>}<p className="mt-1 text-xs text-muted-foreground">Coach task · {timeAgo(r.created_at)}</p>{r.action==="internships"&&<Link className="mt-2 inline-block text-sm underline" to="/talent/internships">Browse internships →</Link>}</div></div>)}</div>}</div>
 </section>;
}
