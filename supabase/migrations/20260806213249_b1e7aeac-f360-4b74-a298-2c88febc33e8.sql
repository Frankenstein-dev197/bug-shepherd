CREATE TABLE public.git_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.git_provider NOT NULL DEFAULT 'github',
  account_id text NOT NULL DEFAULT '',
  account_login text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, account_id)
);

GRANT SELECT (id, user_id, provider, account_id, account_login, avatar_url, scopes, token_expires_at, created_at, updated_at), DELETE ON public.git_connections TO authenticated;
GRANT ALL ON public.git_connections TO service_role;

ALTER TABLE public.git_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own git connections"
  ON public.git_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own git connections"
  ON public.git_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_git_connections_updated_at
  BEFORE UPDATE ON public.git_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.git_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.git_provider NOT NULL DEFAULT 'github',
  redirect_to text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.git_oauth_states TO service_role;

ALTER TABLE public.git_oauth_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.git_repos
  ADD COLUMN connection_id uuid REFERENCES public.git_connections(id) ON DELETE SET NULL,
  ADD COLUMN external_id text NOT NULL DEFAULT '',
  ADD COLUMN webhook_id text NOT NULL DEFAULT '',
  ADD COLUMN webhook_status text NOT NULL DEFAULT 'manual',
  ADD COLUMN webhook_secret text;

GRANT SELECT (id, user_id, provider, full_name, html_url, default_branch, is_active, last_event_at, created_at, updated_at, connection_id, external_id, webhook_id, webhook_status) ON public.git_repos TO authenticated;