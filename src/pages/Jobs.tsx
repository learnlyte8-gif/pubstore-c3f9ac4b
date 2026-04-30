import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  MapPin,
  Building2,
  Bookmark,
  BookmarkCheck,
  Plus,
  Search,
  Users,
  Sparkles,
  ExternalLink,
  Send,
  Upload,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchJobs,
  fetchJob,
  fetchCompanies,
  fetchMyCompanies,
  fetchMyApplications,
  formatSalary,
  JOB_CATEGORIES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORKPLACE_TYPES,
  type JobPosting,
} from "@/data/jobs";
import EmptyState from "@/components/EmptyState";

type Tab = "feed" | "saved" | "applied" | "manage";

export default function Jobs() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("feed");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [workplace, setWorkplace] = useState<string>("");
  const [openJob, setOpenJob] = useState<JobPosting | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showCompany, setShowCompany] = useState(false);

  const { data: userData } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const userId = userData?.id ?? null;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", { category, workplace, query }],
    queryFn: () => fetchJobs({ category: category || undefined, workplace: workplace || undefined, q: query || undefined, limit: 60 }),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["job-companies-top"],
    queryFn: () => fetchCompanies({ limit: 12 }),
  });

  const { data: myCompanies = [] } = useQuery({
    queryKey: ["job-companies-mine", userId],
    queryFn: fetchMyCompanies,
    enabled: !!userId,
  });

  const { data: myApps = [] } = useQuery({
    queryKey: ["job-apps-mine", userId],
    queryFn: fetchMyApplications,
    enabled: !!userId,
  });

  const { data: savedIds = [] } = useQuery({
    queryKey: ["job-saves-mine", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.from("job_saves").select("job_id").eq("user_id", userId);
      return (data ?? []).map((r) => r.job_id as string);
    },
    enabled: !!userId,
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["job-saves-detail", savedIds.join("|")],
    queryFn: async () => {
      if (savedIds.length === 0) return [];
      const { data } = await supabase.from("job_postings").select("*").in("id", savedIds).order("created_at", { ascending: false });
      return (data ?? []) as JobPosting[];
    },
    enabled: savedIds.length > 0,
  });

  const appliedJobsIds = useMemo(() => new Set(myApps.map((a) => a.job_id)), [myApps]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  async function toggleSave(jobId: string) {
    if (!userId) {
      toast.error("Sign in to save jobs");
      nav("/auth");
      return;
    }
    if (savedSet.has(jobId)) {
      await supabase.from("job_saves").delete().eq("user_id", userId).eq("job_id", jobId);
    } else {
      await supabase.from("job_saves").insert({ user_id: userId, job_id: jobId });
    }
    qc.invalidateQueries({ queryKey: ["job-saves-mine"] });
  }

  function openJobSheet(job: JobPosting) {
    setOpenJob(job);
  }

  const visibleJobs = tab === "saved" ? savedJobs : tab === "applied" ? jobs.filter((j) => appliedJobsIds.has(j.id)) : jobs;

  return (
    <div className="pb-24">
      {/* Hero */}
      <header className="px-4 pt-4 pb-4 bg-gradient-to-br from-blue-700 via-indigo-700 to-sky-600 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold leading-tight">Jobs</h1>
              <p className="text-[11px] opacity-90">Hire talent. Find work. Build your network.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowPost(true)} className="bg-white text-foreground hover:bg-white/90">
            <Plus className="w-4 h-4 mr-1" /> Post a job
          </Button>
        </div>

        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, skill, company"
            className="pl-9 bg-white text-foreground placeholder:text-foreground/50 border-0"
          />
        </div>

        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1">
          {(["feed", "saved", "applied", "manage"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-full text-xs font-bold transition ${tab === t ? "bg-white text-foreground" : "text-white/90"}`}
            >
              {t === "feed" ? "All jobs" : t === "saved" ? "Saved" : t === "applied" ? "Applied" : "Manage"}
            </button>
          ))}
        </div>
      </header>

      {/* Filters */}
      {tab === "feed" && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto scrollbar-none">
          <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {JOB_CATEGORIES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={workplace || "all"} onValueChange={(v) => setWorkplace(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs"><SelectValue placeholder="Workplace" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any workplace</SelectItem>
              {WORKPLACE_TYPES.map((w) => <SelectItem key={w.slug} value={w.slug}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Top companies rail */}
      {tab === "feed" && companies.length > 0 && (
        <section className="mt-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Top companies</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {companies.map((c) => (
              <div key={c.id} className="shrink-0 w-32 rounded-2xl bg-card shadow-card p-3 border">
                <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden mb-2">
                  {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Building2 className="w-5 h-5 text-muted-foreground" /></div>}
                </div>
                <div className="text-xs font-bold leading-tight line-clamp-2">{c.name}</div>
                {c.industry && <div className="text-[10px] text-muted-foreground line-clamp-1">{c.industry}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manage tab */}
      {tab === "manage" && (
        <section className="px-4 mt-4 space-y-3">
          <div className="rounded-2xl bg-card shadow-card p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Your companies</h3>
                <p className="text-[11px] text-muted-foreground">Create a company page to post jobs.</p>
              </div>
              <Button size="sm" onClick={() => setShowCompany(true)}><Plus className="w-4 h-4 mr-1" /> New</Button>
            </div>
            {myCompanies.length === 0 ? (
              <EmptyState icon={<Building2 className="w-7 h-7 text-muted-foreground" />} title="No companies yet" description="Create one to start posting jobs." />
            ) : (
              <div className="mt-3 space-y-2">
                {myCompanies.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl border">
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden">
                      {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Building2 className="w-4 h-4 text-muted-foreground" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.industry || "—"} · {c.city || c.country || ""}</div>
                    </div>
                    {c.verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {myApps.length > 0 && (
            <div className="rounded-2xl bg-card shadow-card p-4 border">
              <h3 className="font-bold text-sm mb-2">Your applications</h3>
              <div className="space-y-2">
                {myApps.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-xl border">
                    <div className="text-xs">
                      <div className="font-semibold">Application #{a.id.slice(0, 8)}</div>
                      <div className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
                    </div>
                    <Badge variant={a.status === "hired" ? "default" : a.status === "rejected" ? "destructive" : "secondary"} className="text-[10px] capitalize">{a.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Job list */}
      {tab !== "manage" && (
        <section className="px-4 mt-4 space-y-3">
          {isLoading && <div className="text-center text-xs text-muted-foreground py-6">Loading jobs…</div>}
          {!isLoading && visibleJobs.length === 0 && (
            <EmptyState
              icon={<Briefcase className="w-7 h-7 text-muted-foreground" />}
              title={tab === "saved" ? "No saved jobs yet" : tab === "applied" ? "You haven't applied yet" : "No jobs match your filters"}
              description={tab === "feed" ? "Try a different search or category." : "Browse the All jobs tab to find opportunities."}
            />
          )}
          {visibleJobs.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              saved={savedSet.has(j.id)}
              applied={appliedJobsIds.has(j.id)}
              onOpen={() => openJobSheet(j)}
              onToggleSave={() => toggleSave(j.id)}
            />
          ))}
        </section>
      )}

      {/* Job detail sheet */}
      <Sheet open={!!openJob} onOpenChange={(o) => !o && setOpenJob(null)}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-3xl">
          {openJob && (
            <JobDetail
              job={openJob}
              applied={appliedJobsIds.has(openJob.id)}
              saved={savedSet.has(openJob.id)}
              onApply={() => {
                if (!userId) { nav("/auth"); return; }
                setShowApply(true);
              }}
              onToggleSave={() => toggleSave(openJob.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Apply dialog */}
      {openJob && (
        <ApplyDialog
          open={showApply}
          onClose={() => setShowApply(false)}
          job={openJob}
          userId={userId}
          onSuccess={() => {
            setShowApply(false);
            setOpenJob(null);
            qc.invalidateQueries({ queryKey: ["job-apps-mine"] });
            toast.success("Application submitted");
          }}
        />
      )}

      {/* Post job dialog */}
      <PostJobDialog
        open={showPost}
        onClose={() => setShowPost(false)}
        myCompanies={myCompanies}
        userId={userId}
        onCreatedCompany={() => qc.invalidateQueries({ queryKey: ["job-companies-mine"] })}
        onSuccess={() => {
          setShowPost(false);
          qc.invalidateQueries({ queryKey: ["jobs"] });
          toast.success("Job posted");
        }}
        onNeedCompany={() => { setShowPost(false); setShowCompany(true); }}
      />

      {/* New company dialog */}
      <NewCompanyDialog
        open={showCompany}
        onClose={() => setShowCompany(false)}
        userId={userId}
        onSuccess={() => {
          setShowCompany(false);
          qc.invalidateQueries({ queryKey: ["job-companies-mine"] });
          toast.success("Company page created");
        }}
      />
    </div>
  );
}

// ============== Job Card ==============
function JobCard({
  job,
  saved,
  applied,
  onOpen,
  onToggleSave,
}: {
  job: JobPosting;
  saved: boolean;
  applied: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const { data: company } = useQuery({
    queryKey: ["job-company", job.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("job_companies").select("id,name,logo_url,verified").eq("id", job.company_id).maybeSingle();
      return data;
    },
  });
  const salary = formatSalary(job);

  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl bg-card shadow-card border p-4 active:scale-[0.99] transition">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
          {company?.logo_url ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Building2 className="w-5 h-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight line-clamp-2">{job.title}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {company?.name || "—"}
                {company?.verified && " · ✓"}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
              className="p-1 -m-1 rounded-md hover:bg-muted shrink-0"
              aria-label={saved ? "Unsave" : "Save"}
            >
              {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary" className="text-[10px] capitalize">{job.workplace_type.replace("_", "-")}</Badge>
            <Badge variant="secondary" className="text-[10px] capitalize">{job.employment_type.replace("_", " ")}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{job.experience_level}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            {(job.city || job.country) && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {[job.city, job.country].filter(Boolean).join(", ")}</span>}
            {salary && <span className="font-semibold text-foreground">{salary}</span>}
            {job.applicants_count > 0 && <span>· {job.applicants_count} applicant{job.applicants_count !== 1 ? "s" : ""}</span>}
          </div>
          {applied && <Badge className="mt-2 text-[10px]" variant="default">✓ Applied</Badge>}
        </div>
      </div>
    </button>
  );
}

// ============== Job Detail ==============
function JobDetail({
  job,
  applied,
  saved,
  onApply,
  onToggleSave,
}: {
  job: JobPosting;
  applied: boolean;
  saved: boolean;
  onApply: () => void;
  onToggleSave: () => void;
}) {
  const { data: company } = useQuery({
    queryKey: ["job-company-full", job.company_id],
    queryFn: async () => (await supabase.from("job_companies").select("*").eq("id", job.company_id).maybeSingle()).data,
  });
  const salary = formatSalary(job);

  return (
    <div className="space-y-4">
      <SheetHeader className="text-left">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden shrink-0">
            {company?.logo_url ? <img src={company.logo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Building2 className="w-6 h-6 text-muted-foreground" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base leading-tight">{job.title}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{company?.name}{company?.verified ? " · ✓ Verified" : ""}</p>
            {(job.city || job.country) && <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {[job.city, job.country].filter(Boolean).join(", ")}</p>}
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="capitalize">{job.workplace_type.replace("_", "-")}</Badge>
        <Badge variant="secondary" className="capitalize">{job.employment_type.replace("_", " ")}</Badge>
        <Badge variant="outline" className="capitalize">{job.experience_level}</Badge>
        {job.featured && <Badge className="bg-amber-500 hover:bg-amber-500"><Sparkles className="w-3 h-3 mr-1" /> Featured</Badge>}
      </div>

      {salary && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wide">Salary</div>
          <div className="text-sm font-bold">{salary}</div>
        </div>
      )}

      {job.description && (
        <div>
          <h4 className="text-sm font-bold mb-1">About the role</h4>
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{job.description}</p>
        </div>
      )}

      {job.skills_required.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-1">Required skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {job.skills_required.map((s) => <Badge key={s} variant="outline" className="text-[11px]">{s}</Badge>)}
          </div>
        </div>
      )}

      {job.benefits.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-1">Benefits</h4>
          <ul className="text-sm list-disc pl-5 space-y-0.5">{job.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}

      <div className="sticky bottom-0 bg-background pt-2 pb-2 border-t flex gap-2">
        <Button variant="outline" size="icon" onClick={onToggleSave}>
          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
        </Button>
        {applied ? (
          <Button className="flex-1" disabled>✓ Applied</Button>
        ) : job.apply_mode === "external_url" && job.apply_url ? (
          <Button className="flex-1" asChild>
            <a href={job.apply_url} target="_blank" rel="noopener noreferrer">Apply on company site <ExternalLink className="w-4 h-4 ml-1" /></a>
          </Button>
        ) : job.apply_mode === "external_email" && job.apply_email ? (
          <Button className="flex-1" asChild>
            <a href={`mailto:${job.apply_email}?subject=${encodeURIComponent("Application: " + job.title)}`}>Apply via email</a>
          </Button>
        ) : (
          <Button className="flex-1" onClick={onApply}><Send className="w-4 h-4 mr-1" /> Apply now</Button>
        )}
      </div>
    </div>
  );
}

// ============== Apply Dialog ==============
function ApplyDialog({
  open,
  onClose,
  job,
  userId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  job: JobPosting;
  userId: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [cvLink, setCvLink] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      let cv_url: string | null = null;
      if (cvFile) {
        const ext = cvFile.name.split(".").pop() || "pdf";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("job-cvs").upload(path, cvFile, { upsert: false });
        if (upErr) throw upErr;
        cv_url = path;
      }
      const { error } = await supabase.from("job_applications").insert({
        job_id: job.id,
        applicant_id: userId,
        applicant_name: name,
        applicant_email: email,
        applicant_phone: phone || null,
        cover_letter: coverLetter || null,
        cv_link: cvLink || null,
        cv_url,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Apply to {job.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>Cover letter</Label><Textarea rows={4} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Why you're a great fit…" /></div>
          <div>
            <Label className="flex items-center gap-1"><Upload className="w-3 h-3" /> CV file (PDF/DOC)</Label>
            <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Or CV link</Label>
            <Input value={cvLink} onChange={(e) => setCvLink(e.target.value)} placeholder="https://drive.google.com/…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit application"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== New Company Dialog ==============
function NewCompanyDialog({
  open,
  onClose,
  userId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId) { toast.error("Sign in first"); return; }
    if (!name.trim()) { toast.error("Company name is required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("job_companies").insert({
      owner_user_id: userId,
      name,
      tagline: tagline || null,
      industry: industry || null,
      size: size || null,
      city: city || null,
      country: country || null,
      website: website || null,
      logo_url: logoUrl || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create company page</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One-liner about your business" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div><Label>Size</Label><Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 11-50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          </div>
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          <div><Label>Logo URL</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Post Job Dialog ==============
function PostJobDialog({
  open,
  onClose,
  myCompanies,
  userId,
  onSuccess,
  onNeedCompany,
}: {
  open: boolean;
  onClose: () => void;
  myCompanies: any[];
  userId: string | null;
  onCreatedCompany: () => void;
  onSuccess: () => void;
  onNeedCompany: () => void;
}) {
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [workplaceType, setWorkplaceType] = useState("on_site");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [skills, setSkills] = useState("");
  const [applyMode, setApplyMode] = useState<"in_app" | "external_url" | "external_email">("in_app");
  const [applyUrl, setApplyUrl] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId) { toast.error("Sign in"); return; }
    if (!companyId) { toast.error("Pick a company"); return; }
    if (!title.trim()) { toast.error("Title required"); return; }
    if (applyMode === "external_url" && !applyUrl.trim()) { toast.error("Apply URL required"); return; }
    if (applyMode === "external_email" && !applyEmail.trim()) { toast.error("Apply email required"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("job_postings").insert({
      company_id: companyId,
      posted_by: userId,
      title,
      description: description || null,
      category,
      employment_type: employmentType,
      experience_level: experienceLevel,
      workplace_type: workplaceType,
      city: city || null,
      country: country || null,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      skills_required: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
      apply_mode: applyMode,
      apply_url: applyMode === "external_url" ? applyUrl : null,
      apply_email: applyMode === "external_email" ? applyEmail : null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    onSuccess();
  }

  if (open && myCompanies.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create a company first</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You need at least one company page before you can post jobs. Only suppliers and verified users can post.</p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onNeedCompany}>Create company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Post a job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Company *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select your company" /></SelectTrigger>
              <SelectContent>
                {myCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Job title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior React Developer" /></div>
          <div><Label>Description</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role, responsibilities, requirements…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_CATEGORIES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Workplace</Label>
              <Select value={workplaceType} onValueChange={setWorkplaceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WORKPLACE_TYPES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employment</Label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPLOYMENT_TYPES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Experience</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPERIENCE_LEVELS.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Salary min (USD)</Label><Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} /></div>
            <div><Label>Salary max (USD)</Label><Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} /></div>
          </div>
          <div><Label>Skills (comma-separated)</Label><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Node" /></div>
          <div>
            <Label>How candidates apply</Label>
            <Select value={applyMode} onValueChange={(v: any) => setApplyMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">Through this app</SelectItem>
                <SelectItem value="external_url">External link</SelectItem>
                <SelectItem value="external_email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {applyMode === "external_url" && <div><Label>Apply URL</Label><Input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://" /></div>}
          {applyMode === "external_email" && <div><Label>Apply email</Label><Input type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} /></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Posting…" : "Post job"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
