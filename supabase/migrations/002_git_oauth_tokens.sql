-- Git OAuth tokens table
-- Stores access tokens for connected GitHub/GitLab accounts

CREATE TABLE public.git_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.git_provider NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  provider_user_id text NOT NULL,
  provider_username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
CREATE INDEX git_oauth_tokens_user_idx ON public.git_oauth_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.git_oauth_tokens TO authenticated;
GRANT ALL ON public.git_oauth_tokens TO service_role;
ALTER TABLE public.git_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own tokens
CREATE POLICY "Users manage own git tokens" ON public.git_oauth_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_git_oauth_tokens_updated_at 
  BEFORE UPDATE ON public.git_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add webhooks table for tracking created webhooks
CREATE TABLE public.git_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid NOT NULL REFERENCES public.git_repos(id) ON DELETE CASCADE,
  external_hook_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX git_webhooks_repo_idx ON public.git_webhooks(repo_id);

GRANT SELECT, INSERT, DELETE ON public.git_webhooks TO authenticated;
GRANT ALL ON public.git_webhooks TO service_role;
ALTER TABLE public.git_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can view webhooks for their repos
CREATE POLICY "Users view webhooks for own repos" ON public.git_webhooks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Users create webhooks for own repos" ON public.git_webhooks
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Users delete webhooks for own repos" ON public.git_webhooks
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );
