CREATE TABLE public.git_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host text NOT NULL,
  provider text NOT NULL DEFAULT 'custom',
  source text NOT NULL DEFAULT 'pat',
  username text NOT NULL DEFAULT 'oauth2',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  provider_user_id text,
  provider_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, host)
);

CREATE INDEX git_credentials_user_idx ON public.git_credentials(user_id);

-- Tokens must never be readable by the browser: only backend functions
-- (service_role) can touch this table. The client uses edge functions.
GRANT ALL ON public.git_credentials TO service_role;
ALTER TABLE public.git_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages git credentials"
  ON public.git_credentials FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_git_credentials_updated_at
  BEFORE UPDATE ON public.git_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();