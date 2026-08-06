-- API KEYS
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  key_prefix text NOT NULL,
  key_last4 text NOT NULL DEFAULT '',
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['bugs:read']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash);
CREATE INDEX api_keys_user_idx ON public.api_keys(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api keys" ON public.api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own api keys" ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own api keys" ON public.api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own api keys" ON public.api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API KEY USAGE
CREATE TABLE public.api_key_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT 'GET',
  status_code integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_key_usage_key_idx ON public.api_key_usage(api_key_id, created_at DESC);

GRANT SELECT ON public.api_key_usage TO authenticated;
GRANT ALL ON public.api_key_usage TO service_role;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view usage of own keys" ON public.api_key_usage
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND k.user_id = auth.uid())
  );

-- GIT REPOS
CREATE TYPE public.git_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'other');

CREATE TABLE public.git_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.git_provider NOT NULL DEFAULT 'github',
  full_name text NOT NULL,
  html_url text NOT NULL DEFAULT '',
  default_branch text NOT NULL DEFAULT 'main',
  is_active boolean NOT NULL DEFAULT true,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX git_repos_user_idx ON public.git_repos(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.git_repos TO authenticated;
GRANT ALL ON public.git_repos TO service_role;
ALTER TABLE public.git_repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repos viewable by authenticated" ON public.git_repos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own repos" ON public.git_repos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own repos" ON public.git_repos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own repos" ON public.git_repos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_git_repos_updated_at BEFORE UPDATE ON public.git_repos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GIT EVENTS
CREATE TABLE public.git_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid REFERENCES public.git_repos(id) ON DELETE CASCADE,
  bug_id uuid REFERENCES public.bugs(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'push',
  actor text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  commit_sha text DEFAULT '',
  branch text DEFAULT '',
  html_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX git_events_repo_idx ON public.git_events(repo_id, created_at DESC);
CREATE INDEX git_events_bug_idx ON public.git_events(bug_id);

GRANT SELECT, INSERT, DELETE ON public.git_events TO authenticated;
GRANT ALL ON public.git_events TO service_role;
ALTER TABLE public.git_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by authenticated" ON public.git_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users add events to own repos" ON public.git_events
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Users delete events of own repos" ON public.git_events
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );

-- CONSOLE HISTORY
CREATE TABLE public.console_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command text NOT NULL,
  output text NOT NULL DEFAULT '',
  success boolean NOT NULL DEFAULT true,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX console_history_user_idx ON public.console_history(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.console_history TO authenticated;
GRANT ALL ON public.console_history TO service_role;
ALTER TABLE public.console_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own console history" ON public.console_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own console history" ON public.console_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own console history" ON public.console_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);