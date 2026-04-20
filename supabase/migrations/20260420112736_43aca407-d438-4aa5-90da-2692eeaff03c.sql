
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Roles enum + table (separate table to avoid privilege escalation)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('supplier', 'buyer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.user_roles;
CREATE POLICY "Roles are viewable by everyone"
ON public.user_roles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
CREATE POLICY "Users can insert their own role"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;
CREATE POLICY "Users can update their own role"
ON public.user_roles FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own role" ON public.user_roles;
CREATE POLICY "Users can delete their own role"
ON public.user_roles FOR DELETE
USING (auth.uid() = user_id);
