import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Briefcase, GraduationCap, Pencil, Plus, Sparkles,
  Globe, Linkedin, Mail, Phone, MessageCircle, Link2, FileText, UserPlus, Check, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  fetchSeekerProfile, fetchSeekerExperiences, fetchSeekerEducation,
  type JobSeekerProfile, type JobExperience, type JobEducation,
} from "@/data/jobs";
import EmptyState from "@/components/EmptyState";

export default function JobsProfile() {
  const { userId: routeUserId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authedId, setAuthedId] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editExp, setEditExp] = useState<JobExperience | null>(null);
  const [showExp, setShowExp] = useState(false);
  const [editEdu, setEditEdu] = useState<JobEducation | null>(null);
  const [showEdu, setShowEdu] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthedId(data.user?.id ?? null));
  }, []);

  const profileUserId = routeUserId ?? authedId ?? "";
  const isOwn = !!authedId && (!routeUserId || routeUserId === authedId);

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile", profileUserId],
    queryFn: () => fetchSeekerProfile(profileUserId),
    enabled: !!profileUserId,
  });
  const { data: experiences = [] } = useQuery({
    queryKey: ["seeker-exp", profileUserId],
    queryFn: () => fetchSeekerExperiences(profileUserId),
    enabled: !!profileUserId,
  });
  const { data: education = [] } = useQuery({
    queryKey: ["seeker-edu", profileUserId],
    queryFn: () => fetchSeekerEducation(profileUserId),
    enabled: !!profileUserId,
  });
  const { data: connection } = useQuery({
    queryKey: ["seeker-connection", authedId, profileUserId],
    queryFn: async () => {
      if (!authedId || isOwn) return null;
      const { data } = await supabase
        .from("job_connections")
        .select("*")
        .or(`and(requester_id.eq.${authedId},recipient_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},recipient_id.eq.${authedId})`)
        .maybeSingle();
      return data;
    },
    enabled: !!authedId && !isOwn && !!profileUserId,
  });

  if (!profileUserId) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Sign in to view your professional profile.</p>
        <Button onClick={() => nav("/auth")}>Sign in</Button>
      </div>
    );
  }

  const initials = (profile?.headline || profile?.current_title || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  async function sendConnection() {
    if (!authedId) { nav("/auth"); return; }
    await supabase.from("job_connections").insert({ requester_id: authedId, recipient_id: profileUserId });
    qc.invalidateQueries({ queryKey: ["seeker-connection"] });
    toast.success("Connection request sent");
  }

  return (
    <div className="">
      {/* Cover */}
      <div className="relative h-32 bg-gradient-to-br from-blue-700 via-indigo-700 to-sky-600">
        {profile?.cover_url && <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />}
        <button onClick={() => nav(-1)} className="absolute left-3 top-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar + name block */}
      <div className="px-4 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full bg-card ring-4 ring-background overflow-hidden shadow-card">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary text-2xl font-black">{initials}</div>}
          </div>
          {isOwn ? (
            <Button size="sm" variant="outline" onClick={() => setEditProfile(true)} className="mb-2">
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2 mb-2">
              {connection?.status === "accepted" ? (
                <Badge variant="secondary" className="text-[10px]"><Check className="w-3 h-3 mr-0.5" /> Connected</Badge>
              ) : connection?.status === "pending" ? (
                <Badge variant="outline" className="text-[10px]">Pending</Badge>
              ) : (
                <Button size="sm" onClick={sendConnection}>
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Connect
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => nav("/messages")}>
                <MessageCircle className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-black tracking-tight">{profile?.current_title || profile?.headline || "Your name"}</h1>
          {profile?.headline && <p className="text-sm text-muted-foreground">{profile.headline}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12px] text-muted-foreground">
            {profile?.current_company && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {profile.current_company}</span>}
            {(profile?.location_city || profile?.location_country) && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[profile?.location_city, profile?.location_country].filter(Boolean).join(", ")}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile?.open_to_work && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500">Open to work</Badge>}
            {profile?.open_to_remote && <Badge variant="secondary" className="text-[10px]">Remote OK</Badge>}
            {profile?.years_experience != null && <Badge variant="outline" className="text-[10px]">{profile.years_experience}y exp</Badge>}
          </div>
        </div>
      </div>

      {/* About */}
      {(profile?.about || isOwn) && (
        <Section title="About">
          {profile?.about ? (
            <p className="text-sm whitespace-pre-line text-foreground/90">{profile.about}</p>
          ) : (
            <button onClick={() => setEditProfile(true)} className="text-xs text-primary font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add a summary
            </button>
          )}
        </Section>
      )}

      {/* Skills */}
      {(profile?.skills?.length || isOwn) && (
        <Section title="Skills">
          {profile?.skills?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>)}
            </div>
          ) : (
            <button onClick={() => setEditProfile(true)} className="text-xs text-primary font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add skills
            </button>
          )}
        </Section>
      )}

      {/* Experience */}
      <Section
        title="Experience"
        action={isOwn && (
          <button onClick={() => { setEditExp(null); setShowExp(true); }} className="text-primary"><Plus className="w-4 h-4" /></button>
        )}
      >
        {experiences.length === 0 ? (
          <EmptyState icon={<Briefcase className="w-6 h-6 text-muted-foreground" />} title="No experience yet" description={isOwn ? "Add a role to attract recruiters." : ""} />
        ) : (
          <div className="space-y-3">
            {experiences.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted grid place-items-center shrink-0">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight">{e.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.company}{e.employment_type ? ` · ${e.employment_type}` : ""}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(e.start_date)} – {e.is_current ? "Present" : fmtDate(e.end_date)}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    {isOwn && (
                      <button onClick={() => { setEditExp(e); setShowExp(true); }} className="text-muted-foreground p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {e.description && <p className="text-xs mt-1 text-foreground/80 whitespace-pre-line">{e.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Education */}
      <Section
        title="Education"
        action={isOwn && (
          <button onClick={() => { setEditEdu(null); setShowEdu(true); }} className="text-primary"><Plus className="w-4 h-4" /></button>
        )}
      >
        {education.length === 0 ? (
          <EmptyState icon={<GraduationCap className="w-6 h-6 text-muted-foreground" />} title="No education yet" description={isOwn ? "Showcase your studies." : ""} />
        ) : (
          <div className="space-y-3">
            {education.map((ed) => (
              <div key={ed.id} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted grid place-items-center shrink-0">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight">{ed.school}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[ed.degree, ed.field_of_study].filter(Boolean).join(", ") || "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ed.start_year || "—"}{ed.end_year ? ` – ${ed.end_year}` : ""}
                      </p>
                    </div>
                    {isOwn && (
                      <button onClick={() => { setEditEdu(ed); setShowEdu(true); }} className="text-muted-foreground p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {ed.description && <p className="text-xs mt-1 text-foreground/80 whitespace-pre-line">{ed.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Contact */}
      {(profile?.email || profile?.phone || profile?.whatsapp || profile?.website || profile?.linkedin_url || profile?.cv_url || profile?.cv_link) && (
        <Section title="Contact & links">
          <div className="grid gap-2">
            {profile?.email && <ContactRow icon={Mail} label={profile.email} href={`mailto:${profile.email}`} />}
            {profile?.phone && <ContactRow icon={Phone} label={profile.phone} href={`tel:${profile.phone}`} />}
            {profile?.whatsapp && <ContactRow icon={MessageCircle} label={`WhatsApp: ${profile.whatsapp}`} href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`} />}
            {profile?.website && <ContactRow icon={Globe} label={profile.website} href={profile.website} />}
            {profile?.linkedin_url && <ContactRow icon={Linkedin} label="LinkedIn profile" href={profile.linkedin_url} />}
            {profile?.cv_url && <ContactRow icon={FileText} label="Download CV" href={profile.cv_url} />}
            {profile?.cv_link && <ContactRow icon={Link2} label="CV link" href={profile.cv_link} />}
          </div>
        </Section>
      )}

      {isOwn && !profile && (
        <div className="px-4 mt-6">
          <div className="rounded-2xl bg-card border shadow-card p-5 text-center">
            <Sparkles className="w-7 h-7 mx-auto mb-2 text-primary" />
            <h3 className="font-bold">Build your professional profile</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Get noticed by recruiters and apply with one tap.</p>
            <Button onClick={() => setEditProfile(true)}>Get started</Button>
          </div>
        </div>
      )}

      {/* Edit profile dialog */}
      {isOwn && (
        <ProfileEditor
          open={editProfile}
          onClose={() => setEditProfile(false)}
          userId={authedId!}
          profile={profile ?? null}
          onSaved={() => { setEditProfile(false); qc.invalidateQueries({ queryKey: ["seeker-profile"] }); }}
        />
      )}
      {isOwn && (
        <ExperienceEditor
          open={showExp}
          onClose={() => setShowExp(false)}
          userId={authedId!}
          item={editExp}
          onSaved={() => { setShowExp(false); qc.invalidateQueries({ queryKey: ["seeker-exp"] }); }}
        />
      )}
      {isOwn && (
        <EducationEditor
          open={showEdu}
          onClose={() => setShowEdu(false)}
          userId={authedId!}
          item={editEdu}
          onSaved={() => { setShowEdu(false); qc.invalidateQueries({ queryKey: ["seeker-edu"] }); }}
        />
      )}
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-4 mt-5">
      <div className="bg-card rounded-2xl border shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black tracking-tight">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function ContactRow({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </a>
  );
}

// ============== Profile editor ==============
function ProfileEditor({ open, onClose, userId, profile, onSaved }: {
  open: boolean; onClose: () => void; userId: string; profile: JobSeekerProfile | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    headline: "", about: "", current_title: "", current_company: "",
    location_city: "", location_country: "",
    email: "", phone: "", whatsapp: "", website: "", linkedin_url: "",
    cv_link: "", skills: "", years_experience: "" as string | number,
    open_to_work: true, open_to_remote: true, visibility: "public",
    avatar_url: "", cover_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      headline: profile?.headline ?? "",
      about: profile?.about ?? "",
      current_title: profile?.current_title ?? "",
      current_company: profile?.current_company ?? "",
      location_city: profile?.location_city ?? "",
      location_country: profile?.location_country ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      whatsapp: profile?.whatsapp ?? "",
      website: profile?.website ?? "",
      linkedin_url: profile?.linkedin_url ?? "",
      cv_link: profile?.cv_link ?? "",
      skills: profile?.skills?.join(", ") ?? "",
      years_experience: profile?.years_experience ?? "",
      open_to_work: profile?.open_to_work ?? true,
      open_to_remote: profile?.open_to_remote ?? true,
      visibility: profile?.visibility ?? "public",
      avatar_url: profile?.avatar_url ?? "",
      cover_url: profile?.cover_url ?? "",
    });
  }, [open, profile]);

  async function save() {
    setSaving(true);
    try {
      const skills = form.skills.split(",").map(s => s.trim()).filter(Boolean);
      const payload = {
        user_id: userId,
        headline: form.headline || null,
        about: form.about || null,
        current_title: form.current_title || null,
        current_company: form.current_company || null,
        location_city: form.location_city || null,
        location_country: form.location_country || null,
        email: form.email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        website: form.website || null,
        linkedin_url: form.linkedin_url || null,
        cv_link: form.cv_link || null,
        skills,
        years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        open_to_work: form.open_to_work,
        open_to_remote: form.open_to_remote,
        visibility: form.visibility,
        avatar_url: form.avatar_url || null,
        cover_url: form.cover_url || null,
      };
      const { error } = await supabase.from("job_seeker_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      onSaved();
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Headline"><Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="Senior product designer · ex-Acme" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Current title"><Input value={form.current_title} onChange={e => setForm({ ...form, current_title: e.target.value })} /></Field>
            <Field label="Current company"><Input value={form.current_company} onChange={e => setForm({ ...form, current_company: e.target.value })} /></Field>
          </div>
          <Field label="About"><Textarea rows={4} value={form.about} onChange={e => setForm({ ...form, about: e.target.value })} placeholder="Short summary of who you are" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City"><Input value={form.location_city} onChange={e => setForm({ ...form, location_city: e.target.value })} /></Field>
            <Field label="Country"><Input value={form.location_country} onChange={e => setForm({ ...form, location_country: e.target.value })} /></Field>
          </div>
          <Field label="Skills (comma separated)"><Input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="Figma, React, TypeScript" /></Field>
          <Field label="Years experience"><Input type="number" value={form.years_experience as any} onChange={e => setForm({ ...form, years_experience: e.target.value })} /></Field>
          <Field label="Avatar URL"><Input value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} /></Field>
          <Field label="Cover URL"><Input value={form.cover_url} onChange={e => setForm({ ...form, cover_url: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></Field>
          </div>
          <Field label="Website"><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
          <Field label="CV link (Drive, Dropbox)"><Input value={form.cv_link} onChange={e => setForm({ ...form, cv_link: e.target.value })} /></Field>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-sm">Open to work</Label>
            <Switch checked={form.open_to_work} onCheckedChange={(v) => setForm({ ...form, open_to_work: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-sm">Open to remote</Label>
            <Switch checked={form.open_to_remote} onCheckedChange={(v) => setForm({ ...form, open_to_remote: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

// ============== Experience editor ==============
function ExperienceEditor({ open, onClose, userId, item, onSaved }: {
  open: boolean; onClose: () => void; userId: string; item: JobExperience | null; onSaved: () => void;
}) {
  const [f, setF] = useState({ title: "", company: "", employment_type: "", location: "", start_date: "", end_date: "", is_current: false, description: "" });
  useEffect(() => {
    if (!open) return;
    setF({
      title: item?.title ?? "",
      company: item?.company ?? "",
      employment_type: item?.employment_type ?? "",
      location: item?.location ?? "",
      start_date: item?.start_date ?? "",
      end_date: item?.end_date ?? "",
      is_current: item?.is_current ?? false,
      description: item?.description ?? "",
    });
  }, [open, item]);

  async function save() {
    if (!f.title || !f.company) { toast.error("Title and company are required"); return; }
    const payload = {
      user_id: userId,
      title: f.title, company: f.company,
      employment_type: f.employment_type || null,
      location: f.location || null,
      start_date: f.start_date || null,
      end_date: f.is_current ? null : (f.end_date || null),
      is_current: f.is_current,
      description: f.description || null,
    };
    const { error } = item
      ? await supabase.from("job_seeker_experiences").update(payload).eq("id", item.id)
      : await supabase.from("job_seeker_experiences").insert(payload);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }
  async function remove() {
    if (!item) return;
    await supabase.from("job_seeker_experiences").delete().eq("id", item.id);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "Edit experience" : "Add experience"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Title"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Company"><Input value={f.company} onChange={e => setF({ ...f, company: e.target.value })} /></Field>
          <Field label="Employment type"><Input placeholder="Full-time, Contract…" value={f.employment_type} onChange={e => setF({ ...f, employment_type: e.target.value })} /></Field>
          <Field label="Location"><Input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start"><Input type="date" value={f.start_date ?? ""} onChange={e => setF({ ...f, start_date: e.target.value })} /></Field>
            <Field label="End"><Input type="date" disabled={f.is_current} value={f.end_date ?? ""} onChange={e => setF({ ...f, end_date: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-sm">I currently work here</Label>
            <Switch checked={f.is_current} onCheckedChange={(v) => setF({ ...f, is_current: v })} />
          </div>
          <Field label="Description"><Textarea rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {item ? <Button variant="ghost" onClick={remove}><Trash2 className="w-4 h-4 mr-1 text-destructive" /> Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Education editor ==============
function EducationEditor({ open, onClose, userId, item, onSaved }: {
  open: boolean; onClose: () => void; userId: string; item: JobEducation | null; onSaved: () => void;
}) {
  const [f, setF] = useState({ school: "", degree: "", field_of_study: "", start_year: "" as string | number, end_year: "" as string | number, description: "" });
  useEffect(() => {
    if (!open) return;
    setF({
      school: item?.school ?? "",
      degree: item?.degree ?? "",
      field_of_study: item?.field_of_study ?? "",
      start_year: item?.start_year ?? "",
      end_year: item?.end_year ?? "",
      description: item?.description ?? "",
    });
  }, [open, item]);

  async function save() {
    if (!f.school) { toast.error("School is required"); return; }
    const payload = {
      user_id: userId,
      school: f.school,
      degree: f.degree || null,
      field_of_study: f.field_of_study || null,
      start_year: f.start_year === "" ? null : Number(f.start_year),
      end_year: f.end_year === "" ? null : Number(f.end_year),
      description: f.description || null,
    };
    const { error } = item
      ? await supabase.from("job_seeker_education").update(payload).eq("id", item.id)
      : await supabase.from("job_seeker_education").insert(payload);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }
  async function remove() {
    if (!item) return;
    await supabase.from("job_seeker_education").delete().eq("id", item.id);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? "Edit education" : "Add education"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="School"><Input value={f.school} onChange={e => setF({ ...f, school: e.target.value })} /></Field>
          <Field label="Degree"><Input value={f.degree} onChange={e => setF({ ...f, degree: e.target.value })} /></Field>
          <Field label="Field of study"><Input value={f.field_of_study} onChange={e => setF({ ...f, field_of_study: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start year"><Input type="number" value={f.start_year as any} onChange={e => setF({ ...f, start_year: e.target.value })} /></Field>
            <Field label="End year"><Input type="number" value={f.end_year as any} onChange={e => setF({ ...f, end_year: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {item ? <Button variant="ghost" onClick={remove}><Trash2 className="w-4 h-4 mr-1 text-destructive" /> Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
