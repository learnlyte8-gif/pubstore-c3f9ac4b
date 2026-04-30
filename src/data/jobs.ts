import { supabase } from "@/integrations/supabase/client";

export type JobCompany = {
  id: string;
  owner_user_id: string;
  name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  verified: boolean;
  active: boolean;
  followers_count: number;
};

export type JobPosting = {
  id: string;
  company_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  category: string;
  employment_type: string;
  experience_level: string;
  workplace_type: string;
  city: string | null;
  country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  show_salary: boolean;
  skills_required: string[];
  benefits: string[];
  apply_mode: "in_app" | "external_url" | "external_email";
  apply_url: string | null;
  apply_email: string | null;
  status: "open" | "closed" | "draft";
  featured: boolean;
  views: number;
  applicants_count: number;
  expires_at: string | null;
  created_at: string;
};

export type JobApplication = {
  id: string;
  job_id: string;
  applicant_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  cover_letter: string | null;
  cv_url: string | null;
  cv_link: string | null;
  expected_salary: number | null;
  status: "submitted" | "shortlisted" | "interviewing" | "rejected" | "hired" | "withdrawn";
  employer_notes: string | null;
  created_at: string;
};

export type JobSeekerProfile = {
  id: string;
  user_id: string;
  headline: string | null;
  about: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location_city: string | null;
  location_country: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  linkedin_url: string | null;
  cv_url: string | null;
  cv_link: string | null;
  skills: string[];
  languages: string[];
  years_experience: number | null;
  current_title: string | null;
  current_company: string | null;
  open_to_work: boolean;
  open_to_remote: boolean;
  expected_salary: number | null;
  expected_salary_currency: string;
  expected_salary_period: string;
  visibility: string;
};

export const JOB_CATEGORIES = [
  { slug: "engineering", label: "Engineering" },
  { slug: "design", label: "Design" },
  { slug: "marketing", label: "Marketing" },
  { slug: "sales", label: "Sales" },
  { slug: "finance", label: "Finance" },
  { slug: "operations", label: "Operations" },
  { slug: "customer_support", label: "Customer Support" },
  { slug: "hr", label: "Human Resources" },
  { slug: "product", label: "Product" },
  { slug: "data", label: "Data & Analytics" },
  { slug: "logistics", label: "Logistics" },
  { slug: "construction", label: "Construction" },
  { slug: "hospitality", label: "Hospitality" },
  { slug: "healthcare", label: "Healthcare" },
  { slug: "education", label: "Education" },
  { slug: "general", label: "Other" },
];

export const EMPLOYMENT_TYPES = [
  { slug: "full_time", label: "Full-time" },
  { slug: "part_time", label: "Part-time" },
  { slug: "contract", label: "Contract" },
  { slug: "internship", label: "Internship" },
  { slug: "temporary", label: "Temporary" },
  { slug: "freelance", label: "Freelance" },
];

export const EXPERIENCE_LEVELS = [
  { slug: "intern", label: "Internship" },
  { slug: "entry", label: "Entry level" },
  { slug: "mid", label: "Mid level" },
  { slug: "senior", label: "Senior" },
  { slug: "lead", label: "Lead / Manager" },
  { slug: "executive", label: "Executive" },
];

export const WORKPLACE_TYPES = [
  { slug: "on_site", label: "On-site" },
  { slug: "hybrid", label: "Hybrid" },
  { slug: "remote", label: "Remote" },
];

export async function fetchJobs(opts: { category?: string; workplace?: string; q?: string; limit?: number } = {}): Promise<JobPosting[]> {
  let q = supabase.from("job_postings").select("*").eq("status", "open").order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.workplace) q = q.eq("workplace_type", opts.workplace);
  if (opts.q) q = q.ilike("title", `%${opts.q}%`);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as JobPosting[];
}

export async function fetchJob(id: string): Promise<JobPosting | null> {
  const { data } = await supabase.from("job_postings").select("*").eq("id", id).maybeSingle();
  return (data as JobPosting) ?? null;
}

export async function fetchCompanies(opts: { limit?: number } = {}): Promise<JobCompany[]> {
  let q = supabase.from("job_companies").select("*").eq("active", true).order("verified", { ascending: false }).order("created_at", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as JobCompany[];
}

export async function fetchCompany(id: string): Promise<JobCompany | null> {
  const { data } = await supabase.from("job_companies").select("*").eq("id", id).maybeSingle();
  return (data as JobCompany) ?? null;
}

export async function fetchMyCompanies(): Promise<JobCompany[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("job_companies").select("*").eq("owner_user_id", u.user.id).order("created_at", { ascending: false });
  return (data ?? []) as JobCompany[];
}

export async function fetchMyApplications(): Promise<JobApplication[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("job_applications").select("*").eq("applicant_id", u.user.id).order("created_at", { ascending: false });
  return (data ?? []) as JobApplication[];
}

export async function fetchApplicationsForJob(jobId: string): Promise<JobApplication[]> {
  const { data } = await supabase.from("job_applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  return (data ?? []) as JobApplication[];
}

export async function fetchSeekerProfile(userId: string): Promise<JobSeekerProfile | null> {
  const { data } = await supabase.from("job_seeker_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as JobSeekerProfile) ?? null;
}

export function formatSalary(j: Pick<JobPosting, "salary_min" | "salary_max" | "salary_currency" | "salary_period" | "show_salary">) {
  if (!j.show_salary || (!j.salary_min && !j.salary_max)) return null;
  const cur = j.salary_currency || "USD";
  const per = j.salary_period === "year" ? "/yr" : j.salary_period === "hour" ? "/hr" : "/mo";
  if (j.salary_min && j.salary_max) return `${cur} ${Math.round(j.salary_min)}–${Math.round(j.salary_max)}${per}`;
  return `${cur} ${Math.round((j.salary_min ?? j.salary_max)!)}${per}`;
}
