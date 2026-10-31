import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CoachRecommendations } from "@/components/talent/CoachRecommendations";
import { SectionHeading, timeAgo, linkButton } from "@/components/site/ui";
export const Route = createFileRoute("/talent/coach")({ head: () => ({meta:[{title:"Your Coach | Savant"}]}),component:CoachPage });
type Shared = { id:string; shared_by:string; shared_by_name:string; note:string|null; external_url:string|null; external_title:string|null; external_company:string|null; created_at:string; jobs:{title:string;company_name:string|null;apply_url:string|null}|null };
type Notice = {id:string; title:string; body:string|null; created_at:string};
function CoachPage(){
 const {userId}=Route.useRouteContext();
 const [jobs,setJobs]=useState<Shared[]>([]);
 const [notices,setNotices]=useState<Notice[]>([]);
 useEffect(()=>{void (async()=>{
  const [a,b]=await Promise.all([
   supabase.from("shared_jobs").select("id,shared_by,shared_by_name,note,external_url,external_title,external_company,created_at,jobs(title,company_name,apply_url)").eq("talent_id",userId).order("created_at",{ascending:false}),
   supabase.from("notifications").select("id,title,body,created_at").eq("user_id",userId).in("kind",["coach_recommendation","job_shared"]).order("created_at",{ascending:false}).limit(50)
  ]);
  setJobs((a.data as unknown as Shared[])??[]);setNotices(b.data??[]);
 })()},[userId]);
 return <section className="space-y-12">
 <div><h2 className="text-2xl font-semibold">Coach</h2><p className="mt-2 text-sm text-muted-foreground">Recommendations, updates and jobs from your Savant coaches.</p></div>
 <CoachRecommendations talentId={userId}/>
 <div><SectionHeading title="Coach updates & notifications"/>{notices.length===0?<p className="mt-4 text-sm text-muted-foreground">No updates yet.</p>:<ul className="mt-4 divide-y divide-[color:var(--color-hairline)]">{notices.map(n=><li className="py-4" key={n.id}><p className="font-medium">{n.title}</p>{n.body&&<p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}<p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p></li>)}</ul>}</div>
 <div><SectionHeading title="Jobs sent by your coach"/>{jobs.length===0?<p className="mt-4 text-sm text-muted-foreground">No shared jobs yet.</p>:<ul className="mt-4 divide-y divide-[color:var(--color-hairline)]">{jobs.map(j=><li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="font-medium">{j.jobs?.title??j.external_title??"Position"}</div><p className="text-sm text-muted-foreground">{j.jobs?.company_name??j.external_company} · {j.shared_by_name} · {timeAgo(j.created_at)}</p>{j.note&&<p className="mt-1 text-sm">{j.note}</p>}</div>{(j.jobs?.apply_url??j.external_url)&&<a href={(j.jobs?.apply_url??j.external_url)!} target="_blank" rel="noopener noreferrer" className={linkButton}>View job ↗</a>}</li>)}</ul>}</div>
 <Link to="/talent/tasks" className={linkButton}>View accepted tasks →</Link>
 </section>;
}
