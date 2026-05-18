
-- Enums
DO $$ BEGIN CREATE TYPE public.like_target AS ENUM ('product','supplier','catalog','post'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.share_channel AS ENUM ('chat','external','copy'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_kind AS ENUM ('buyer_supplier','dm','group_buy'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.group_buy_status AS ENUM ('open','locked','fulfilled','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.group_buy_role AS ENUM ('owner','member','invited'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.invite_status AS ENUM ('pending','accepted','declined'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- user_follows
CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON public.user_follows(followee_id);
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_follows public read" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "user_follows self insert" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "user_follows self delete" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

-- post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.like_target NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_target ON public.post_likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_likes public read" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes self insert" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes self delete" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- shares
CREATE TABLE IF NOT EXISTS public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.like_target NOT NULL,
  target_id uuid NOT NULL,
  channel public.share_channel NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shares_target ON public.shares(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_shares_user ON public.shares(user_id);
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares own all" ON public.shares USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- conversations extension
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind public.conversation_kind NOT NULL DEFAULT 'buyer_supplier',
  ADD COLUMN IF NOT EXISTS peer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_buy_id uuid,
  ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.conversations ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_buyer_id_supplier_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_buyer_supplier
  ON public.conversations(buyer_id, supplier_id)
  WHERE kind = 'buyer_supplier' AND supplier_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_dm_pair
  ON public.conversations(LEAST(buyer_id, peer_user_id), GREATEST(buyer_id, peer_user_id))
  WHERE kind = 'dm' AND peer_user_id IS NOT NULL;

-- conversation_members
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_uid uuid, _cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _cid AND user_id = _uid);
$$;

CREATE POLICY "conv_members visible to members" ON public.conversation_members
  FOR SELECT USING (public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "conv_members self leave" ON public.conversation_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "conv_members self join" ON public.conversation_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Refresh conversation/message policies
DROP POLICY IF EXISTS "Conv visible to participants" ON public.conversations;
CREATE POLICY "Conv visible to participants" ON public.conversations FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = peer_user_id
  OR (supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = conversations.supplier_id AND s.owner_id = auth.uid()))
  OR public.is_conversation_member(auth.uid(), id)
);
DROP POLICY IF EXISTS "Participants update conversation" ON public.conversations;
CREATE POLICY "Participants update conversation" ON public.conversations FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = peer_user_id
  OR (supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = conversations.supplier_id AND s.owner_id = auth.uid()))
  OR public.is_conversation_member(auth.uid(), id)
);
DROP POLICY IF EXISTS "Buyer starts conversation" ON public.conversations;
CREATE POLICY "Start conversation" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Messages visible to participants" ON public.messages;
CREATE POLICY "Messages visible to participants" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (
      c.buyer_id = auth.uid() OR c.peer_user_id = auth.uid()
      OR (c.supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()))
      OR public.is_conversation_member(auth.uid(), c.id)
    )
  )
);
DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (
      c.buyer_id = auth.uid() OR c.peer_user_id = auth.uid()
      OR (c.supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()))
      OR public.is_conversation_member(auth.uid(), c.id)
    )
  )
);
DROP POLICY IF EXISTS "Participants can react" ON public.messages;
CREATE POLICY "Participants can react" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (
      c.buyer_id = auth.uid() OR c.peer_user_id = auth.uid()
      OR (c.supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()))
      OR public.is_conversation_member(auth.uid(), c.id)
    )
  )
);

-- group_buys
CREATE TABLE IF NOT EXISTS public.group_buys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_qty integer NOT NULL CHECK (target_qty > 0),
  deadline timestamptz,
  status public.group_buy_status NOT NULL DEFAULT 'open',
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_buys_product ON public.group_buys(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buys_supplier ON public.group_buys(supplier_id);
CREATE INDEX IF NOT EXISTS idx_group_buys_owner ON public.group_buys(owner_id);
ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER group_buys_updated_at BEFORE UPDATE ON public.group_buys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.group_buy_members (
  group_id uuid NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  role public.group_buy_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_buy_members_user ON public.group_buy_members(user_id);
ALTER TABLE public.group_buy_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_buy_member(_uid uuid, _gid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_buy_members WHERE group_id = _gid AND user_id = _uid);
$$;
CREATE OR REPLACE FUNCTION public.is_group_buy_owner(_uid uuid, _gid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_buys WHERE id = _gid AND owner_id = _uid);
$$;

CREATE POLICY "group_buys visible" ON public.group_buys FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_group_buy_member(auth.uid(), id)
  OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = group_buys.supplier_id AND s.owner_id = auth.uid())
);
CREATE POLICY "group_buys owner insert" ON public.group_buys FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "group_buys owner update" ON public.group_buys FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "group_buys owner delete" ON public.group_buys FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "group_buy_members visible to members" ON public.group_buy_members FOR SELECT USING (
  public.is_group_buy_member(auth.uid(), group_id) OR public.is_group_buy_owner(auth.uid(), group_id)
);
CREATE POLICY "group_buy_members self join" ON public.group_buy_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_buy_members self update qty" ON public.group_buy_members FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_buy_members leave" ON public.group_buy_members FOR DELETE USING (
  auth.uid() = user_id OR public.is_group_buy_owner(auth.uid(), group_id)
);

CREATE TABLE IF NOT EXISTS public.group_buy_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (group_id, invitee_id)
);
CREATE INDEX IF NOT EXISTS idx_gbi_invitee ON public.group_buy_invites(invitee_id);
ALTER TABLE public.group_buy_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gb_invites visible" ON public.group_buy_invites FOR SELECT USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid() OR public.is_group_buy_owner(auth.uid(), group_id)
);
CREATE POLICY "gb_invites owner insert" ON public.group_buy_invites FOR INSERT WITH CHECK (
  inviter_id = auth.uid()
  AND (public.is_group_buy_owner(auth.uid(), group_id) OR public.is_group_buy_member(auth.uid(), group_id))
);
CREATE POLICY "gb_invites invitee responds" ON public.group_buy_invites FOR UPDATE
  USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid());

-- Bootstrap group buy: create chat + add owner
CREATE OR REPLACE FUNCTION public.bootstrap_group_buy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id uuid;
BEGIN
  INSERT INTO public.conversations (buyer_id, supplier_id, kind, group_buy_id, title)
  VALUES (NEW.owner_id, NEW.supplier_id, 'group_buy', NEW.id, NEW.title)
  RETURNING id INTO conv_id;
  UPDATE public.group_buys SET conversation_id = conv_id WHERE id = NEW.id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, NEW.owner_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_buy_members (group_id, user_id, qty, role) VALUES (NEW.id, NEW.owner_id, 1, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bootstrap_group_buy AFTER INSERT ON public.group_buys
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_group_buy();

CREATE OR REPLACE FUNCTION public.on_group_buy_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id uuid; total integer; tgt integer; sup_owner uuid; prod_title text;
BEGIN
  SELECT conversation_id, target_qty INTO conv_id, tgt FROM public.group_buys WHERE id = NEW.group_id;
  IF conv_id IS NOT NULL THEN
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, NEW.user_id) ON CONFLICT DO NOTHING;
  END IF;
  SELECT COALESCE(SUM(qty), 0) INTO total FROM public.group_buy_members WHERE group_id = NEW.group_id;
  IF total >= tgt THEN
    UPDATE public.group_buys SET status = 'locked' WHERE id = NEW.group_id AND status = 'open';
    SELECT s.owner_id, p.title INTO sup_owner, prod_title
      FROM public.group_buys gb
      JOIN public.suppliers s ON s.id = gb.supplier_id
      JOIN public.products p ON p.id = gb.product_id
      WHERE gb.id = NEW.group_id;
    IF sup_owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (sup_owner, 'group_buy_locked', 'Group buy reached its target',
        COALESCE(prod_title, 'A product') || ' — ' || total || ' units pooled', '/messages');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_group_buy_join AFTER INSERT ON public.group_buy_members
  FOR EACH ROW EXECUTE FUNCTION public.on_group_buy_join();

CREATE OR REPLACE FUNCTION public.notify_user_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE follower_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO follower_name FROM public.profiles WHERE user_id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.followee_id, 'user_followed_you', COALESCE(follower_name, 'Someone') || ' followed you', NULL, '/u/' || NEW.follower_id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_user_follow AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_follow();

CREATE OR REPLACE FUNCTION public.notify_group_buy_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inviter_name text; gb_title text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO inviter_name FROM public.profiles WHERE user_id = NEW.inviter_id;
  SELECT title INTO gb_title FROM public.group_buys WHERE id = NEW.group_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.invitee_id, 'group_buy_invite',
    COALESCE(inviter_name, 'Someone') || ' invited you to a group buy',
    gb_title, '/group-buy/' || NEW.group_id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_group_buy_invite AFTER INSERT ON public.group_buy_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_buy_invite();

-- Personalized feed (fixed array predicate)
CREATE OR REPLACE FUNCTION public.personalized_feed(_user_id uuid, _limit int DEFAULT 60)
RETURNS TABLE (product_id uuid, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  user_int AS (
    SELECT COALESCE(interests, '{}'::text[]) AS arr FROM public.profiles WHERE user_id = _user_id
  ),
  followed_sup AS (
    SELECT supplier_id FROM public.followers WHERE user_id = _user_id
  ),
  liked_cats AS (
    SELECT p.category_slug, COUNT(*)::int AS c
    FROM public.post_likes l JOIN public.products p ON p.id = l.target_id
    WHERE l.user_id = _user_id AND l.target_type = 'product'
    GROUP BY p.category_slug
  ),
  social AS (
    SELECT target_id, COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS likes_30d
    FROM public.post_likes WHERE target_type = 'product' GROUP BY target_id
  )
  SELECT p.id,
    (
      0.45 * EXP(- EXTRACT(EPOCH FROM (now() - p.created_at)) / (72.0 * 3600.0))
      + 0.20 * CASE WHEN EXISTS (SELECT 1 FROM user_int ui WHERE p.category_slug = ANY (ui.arr)) THEN 1 ELSE 0 END
      + 0.15 * CASE WHEN p.supplier_id IN (SELECT supplier_id FROM followed_sup) THEN 1 ELSE 0 END
      + 0.10 * LN(1 + COALESCE((SELECT likes_30d FROM social WHERE target_id = p.id), 0) + 2.0 * COALESCE(p.sold, 0) / 50.0)
      + 0.10 * COALESCE((SELECT c::numeric / 5 FROM liked_cats WHERE category_slug = p.category_slug), 0)
    )::numeric AS score
  FROM public.products p
  WHERE p.active = true
  ORDER BY score DESC, p.created_at DESC
  LIMIT _limit;
$$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_follows; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_buys; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_buy_members; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_buy_invites; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN duplicate_object THEN null; END $$;
