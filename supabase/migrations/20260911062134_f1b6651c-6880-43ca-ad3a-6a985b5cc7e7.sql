CREATE TABLE public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok','instagram','facebook','x','youtube','linkedin','pinterest','threads','whatsapp')),
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, username)
);

CREATE TABLE public.ad_media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video','audio','logo')),
  url TEXT NOT NULL,
  title TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  bytes BIGINT,
  width INT,
  height INT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ad_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'square' CHECK (format IN ('square','vertical')),
  description TEXT,
  caption_prompt TEXT,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.social_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.ad_templates(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'square' CHECK (format IN ('square','vertical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','posted','archived')),
  headline TEXT,
  subhead TEXT,
  badge TEXT,
  caption TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  cta TEXT,
  image_url TEXT,
  video_url TEXT,
  media_id UUID REFERENCES public.ad_media_library(id) ON DELETE SET NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  account_ids UUID[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_ads_status ON public.social_ads(status, created_at DESC);
CREATE INDEX idx_social_ads_product ON public.social_ads(product_id);
CREATE INDEX idx_ad_media_kind ON public.ad_media_library(kind, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_media_library TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ads TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
GRANT ALL ON public.ad_media_library TO service_role;
GRANT ALL ON public.ad_templates TO service_role;
GRANT ALL ON public.social_ads TO service_role;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage social accounts" ON public.social_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage ad media" ON public.ad_media_library FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage ad templates" ON public.ad_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage social ads" ON public.social_ads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_social_accounts_updated BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ad_templates_updated BEFORE UPDATE ON public.ad_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_ads_updated BEFORE UPDATE ON public.social_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ad_templates (name, format, description, caption_prompt, style) VALUES
  ('Bold Deal — Square','square','Big price flash on a dark gradient, product front and centre.','Punchy deal caption with urgency, 2 short lines.','{"bg":"#0f172a","accent":"#22c55e","text":"#ffffff","layout":"deal"}'),
  ('Clean Product — Square','square','Minimal white card with product name and price.','Calm, benefit-led caption, no hype.','{"bg":"#ffffff","accent":"#0ea5e9","text":"#0f172a","layout":"clean"}'),
  ('Reel Hook — Vertical','vertical','Full-bleed product with a hook headline at the top and CTA at the bottom.','Short scroll-stopping hook, then one benefit line, then CTA.','{"bg":"#0f172a","accent":"#f97316","text":"#ffffff","layout":"hook"}'),
  ('Story Sale — Vertical','vertical','Gradient story frame with discount badge.','Flash-sale caption with a deadline feel.','{"bg":"#1a1035","accent":"#e11d48","text":"#ffffff","layout":"sale"}');