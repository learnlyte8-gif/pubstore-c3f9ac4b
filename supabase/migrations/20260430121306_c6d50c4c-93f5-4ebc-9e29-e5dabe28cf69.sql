-- =================== JOBS VERTICAL ===================

-- Job seeker profiles (LinkedIn-style)
CREATE TABLE public.job_seeker_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  headline TEXT,
  about TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  location_city TEXT,
  location_country TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  linkedin_url TEXT,
  cv_url TEXT,
  cv_link TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{}',
  years_experience NUMERIC,
  current_title TEXT,
  current_company TEXT,
  open_to_work BOOLEAN NOT NULL DEFAULT true,
  open_to_remote BOOLEAN NOT NULL DEFAULT true,
  expected_salary NUMERIC,
  expected_salary_currency TEXT NOT NULL DEFAULT 'USD',
  expected_salary_period TEXT NOT NULL DEFAULT 'month',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_seeker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public seeker profiles read"
  ON public.job_seeker_profiles FOR SELECT
  USING (visibility = 'public' OR auth.uid() = user_id);

CREATE POLICY "Owner manages seeker profile"
  ON public.job_seeker_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_job_seeker_profiles_updated
  BEFORE UPDATE ON public.job_seeker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Experience entries
CREATE TABLE public.job_seeker_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  employment_type TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_seeker_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Experiences public read"
  ON public.job_seeker_experiences FOR SELECT USING (true);

CREATE POLICY "Owner manages experiences"
  ON public.job_seeker_experiences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Education entries
CREATE TABLE public.job_seeker_education (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_year INTEGER,
  end_year INTEGER,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_seeker_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Education public read"
  ON public.job_seeker_education FOR SELECT USING (true);

CREATE POLICY "Owner manages education"
  ON public.job_seeker_education FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Companies (employer profiles for jobs)
CREATE TABLE public.job_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  supplier_id UUID,
  name TEXT NOT NULL,
  tagline TEXT,
  about TEXT,
  logo_url TEXT,
  cover_url TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  city TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  followers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies public read"
  ON public.job_companies FOR SELECT
  USING (active = true OR auth.uid() = owner_user_id);

CREATE POLICY "Owner manages company"
  ON public.job_companies FOR ALL
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER trg_job_companies_updated
  BEFORE UPDATE ON public.job_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Job postings
CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.job_companies(id) ON DELETE CASCADE,
  posted_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  experience_level TEXT NOT NULL DEFAULT 'mid',
  workplace_type TEXT NOT NULL DEFAULT 'on_site',
  city TEXT,
  country TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  salary_period TEXT NOT NULL DEFAULT 'month',
  show_salary BOOLEAN NOT NULL DEFAULT true,
  skills_required TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  apply_mode TEXT NOT NULL DEFAULT 'in_app',
  apply_url TEXT,
  apply_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  applicants_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs public read"
  ON public.job_postings FOR SELECT
  USING (status = 'open' OR auth.uid() = posted_by OR EXISTS (
    SELECT 1 FROM public.job_companies c
    WHERE c.id = job_postings.company_id AND c.owner_user_id = auth.uid()
  ));

CREATE POLICY "Eligible users create job"
  ON public.job_postings FOR INSERT
  WITH CHECK (
    auth.uid() = posted_by
    AND EXISTS (
      SELECT 1 FROM public.job_companies c
      WHERE c.id = job_postings.company_id AND c.owner_user_id = auth.uid()
    )
    AND (
      EXISTS (SELECT 1 FROM public.suppliers s WHERE s.owner_id = auth.uid())
      OR public.is_cod_verified(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Owner updates job"
  ON public.job_postings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.job_companies c
    WHERE c.id = job_postings.company_id AND c.owner_user_id = auth.uid()
  ));

CREATE POLICY "Owner deletes job"
  ON public.job_postings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.job_companies c
    WHERE c.id = job_postings.company_id AND c.owner_user_id = auth.uid()
  ));

CREATE TRIGGER trg_job_postings_updated
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_job_postings_status ON public.job_postings(status);
CREATE INDEX idx_job_postings_company ON public.job_postings(company_id);
CREATE INDEX idx_job_postings_category ON public.job_postings(category);

-- Applications
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  applicant_name TEXT,
  applicant_email TEXT,
  applicant_phone TEXT,
  cover_letter TEXT,
  cv_url TEXT,
  cv_link TEXT,
  expected_salary NUMERIC,
  status TEXT NOT NULL DEFAULT 'submitted',
  employer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant creates application"
  ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Application parties read"
  ON public.job_applications FOR SELECT
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.job_companies c ON c.id = j.company_id
      WHERE j.id = job_applications.job_id AND c.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Application parties update"
  ON public.job_applications FOR UPDATE
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.job_companies c ON c.id = j.company_id
      WHERE j.id = job_applications.job_id AND c.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Applicant deletes own application"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = applicant_id);

CREATE TRIGGER trg_job_applications_updated
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX idx_job_applications_applicant ON public.job_applications(applicant_id);

-- Saved jobs
CREATE TABLE public.job_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE public.job_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own job saves"
  ON public.job_saves FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Connections (LinkedIn-style)
CREATE TABLE public.job_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, recipient_id),
  CHECK (requester_id <> recipient_id)
);

ALTER TABLE public.job_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connection parties read"
  ON public.job_connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "User sends connection"
  ON public.job_connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Connection parties update"
  ON public.job_connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Connection parties delete"
  ON public.job_connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE TRIGGER trg_job_connections_updated
  BEFORE UPDATE ON public.job_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Skill endorsements
CREATE TABLE public.job_skill_endorsements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endorser_id UUID NOT NULL,
  endorsee_id UUID NOT NULL,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endorser_id, endorsee_id, skill),
  CHECK (endorser_id <> endorsee_id)
);

ALTER TABLE public.job_skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endorsements public read"
  ON public.job_skill_endorsements FOR SELECT USING (true);

CREATE POLICY "User endorses"
  ON public.job_skill_endorsements FOR INSERT
  WITH CHECK (auth.uid() = endorser_id);

CREATE POLICY "User unendorses"
  ON public.job_skill_endorsements FOR DELETE
  USING (auth.uid() = endorser_id);

-- Feed posts
CREATE TABLE public.job_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  media TEXT[] NOT NULL DEFAULT '{}',
  link_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts public read"
  ON public.job_posts FOR SELECT
  USING (visibility = 'public' OR auth.uid() = author_id);

CREATE POLICY "User creates post"
  ON public.job_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author manages post"
  ON public.job_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Author deletes post"
  ON public.job_posts FOR DELETE
  USING (auth.uid() = author_id);

CREATE TRIGGER trg_job_posts_updated
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Post likes
CREATE TABLE public.job_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.job_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes public read"
  ON public.job_post_likes FOR SELECT USING (true);
CREATE POLICY "User likes"
  ON public.job_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User unlikes"
  ON public.job_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Post comments
CREATE TABLE public.job_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments public read"
  ON public.job_post_comments FOR SELECT USING (true);
CREATE POLICY "User comments"
  ON public.job_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author manages comment"
  ON public.job_post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Author deletes comment"
  ON public.job_post_comments FOR DELETE USING (auth.uid() = user_id);

-- Storage buckets for jobs
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-cvs', 'job-cvs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-media', 'job-media', true)
ON CONFLICT (id) DO NOTHING;

-- job-media: public read, owner writes under {user_id}/...
CREATE POLICY "Job media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-media');

CREATE POLICY "User uploads job media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "User updates own job media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "User deletes own job media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- job-cvs: private. Applicant uploads under {applicant_id}/..., applicant + employers of applied jobs can read
CREATE POLICY "Applicant uploads CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Applicant updates own CV"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Applicant deletes own CV"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Applicant reads own CV"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job-cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Employers read applicants CV"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job-cvs'
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      JOIN public.job_postings j ON j.id = a.job_id
      JOIN public.job_companies c ON c.id = j.company_id
      WHERE c.owner_user_id = auth.uid()
        AND a.applicant_id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- Trigger: increment applicants_count
CREATE OR REPLACE FUNCTION public.increment_job_applicants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.job_postings SET applicants_count = applicants_count + 1 WHERE id = NEW.job_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_job_applicants_count
  AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.increment_job_applicants();

-- Trigger: notify employer of new application
CREATE OR REPLACE FUNCTION public.notify_new_job_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_uid UUID;
  job_title TEXT;
BEGIN
  SELECT c.owner_user_id, j.title
    INTO owner_uid, job_title
    FROM public.job_postings j
    JOIN public.job_companies c ON c.id = j.company_id
    WHERE j.id = NEW.job_id;
  IF owner_uid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    owner_uid, 'job_application',
    'New application',
    COALESCE(NEW.applicant_name, 'Someone') || ' applied to ' || COALESCE(job_title, 'your job'),
    '/jobs/applications/' || NEW.job_id
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_job_application
  AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_job_application();

-- Trigger: notify applicant of status change
CREATE OR REPLACE FUNCTION public.notify_job_application_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  job_title TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO job_title FROM public.job_postings WHERE id = NEW.job_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.applicant_id, 'job_application_status',
    'Application ' || NEW.status,
    'Your application to ' || COALESCE(job_title, 'a job') || ' is now ' || NEW.status,
    '/jobs/my-applications'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_job_app_status
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_application_status();

-- Trigger: notify on connection request + acceptance
CREATE OR REPLACE FUNCTION public.notify_job_connection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.recipient_id, 'job_connection_request',
      'New connection request', LEFT(COALESCE(NEW.message, 'wants to connect with you'), 120),
      '/jobs/network');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.requester_id, 'job_connection_accepted',
      'Connection accepted', NULL, '/jobs/network');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_job_connection_ins
  AFTER INSERT ON public.job_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_connection();

CREATE TRIGGER trg_notify_job_connection_upd
  AFTER UPDATE ON public.job_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_connection();