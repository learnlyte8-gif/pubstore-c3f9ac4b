-- Auto-verify a specific email address on signup (and ensure it's confirmed now)
CREATE OR REPLACE FUNCTION public.auto_confirm_special_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'kukistacks8@gmail.com' AND NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
    NEW.confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_special_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_special_email_trigger
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_special_email();

-- Also ensure the existing user is confirmed right now
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'kukistacks8@gmail.com';