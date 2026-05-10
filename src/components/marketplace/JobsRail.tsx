import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchJobs, type JobPosting } from "@/data/jobs";
import { Briefcase, MapPin, Building2, Sparkles } from "lucide-react";

const MOCK: Array<Partial<JobPosting> & { id: string; title: string; company: string; city: string; type: string; salary: string; tag: string }> = [
  { id: "mock-j1", title: "Senior Product Designer", company: "Lumen Studio", city: "Cape Town · Hybrid", type: "Full-time", salary: "$3.2k–4.5k/mo", tag: "Featured" },
  { id: "mock-j2", title: "React Native Engineer", company: "PayWave", city: "Remote · Africa", type: "Contract", salary: "$45/hr", tag: "Remote" },
  { id: "mock-j3", title: "Growth Marketer", company: "Kasi Foods", city: "Harare · On-site", type: "Full-time", salary: "$1.8k/mo", tag: "Hot" },
];

export default function JobsRail() {
  const { data: jobs = [] } = useQuery({ queryKey: ["home-jobs-rail"], queryFn: () => fetchJobs({ limit: 6 }) });

  const items = jobs.length > 0
    ? jobs.slice(0, 6).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.category,
        city: [j.city, j.workplace_type?.replace("_", " ")].filter(Boolean).join(" · ") || "Anywhere",
        type: j.employment_type?.replace("_", " ") ?? "Full-time",
        salary: j.salary_min ? `${j.salary_currency} ${j.salary_min}+` : "Competitive",
        tag: j.featured ? "Featured" : "New",
      }))
    : MOCK;

  return (
    <section className="px-4 mt-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-2.5">
          <span className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-pop">
            <Briefcase className="w-4 h-4 text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="text-base font-extrabold leading-tight tracking-tight">Jobs trending now</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Hand-picked roles hiring this week</p>
          </div>
        </div>
        <Link to="/jobs" className="text-xs font-bold text-primary">See all</Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1 snap-x snap-mandatory">
        {items.map((j) => (
          <Link
            key={j.id}
            to="/jobs"
            className="shrink-0 w-60 snap-start rounded-2xl border border-border bg-card shadow-card p-3 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> {j.tag}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground capitalize">{j.type}</span>
            </div>
            <p className="font-extrabold text-sm leading-tight mt-2 line-clamp-2">{j.title}</p>
            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1 capitalize"><Building2 className="w-3 h-3" /> {j.company}</p>
              <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {j.city}</p>
            </div>
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm font-black tracking-tight">{j.salary}</span>
              <span className="text-[10px] font-bold text-primary">Apply →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
