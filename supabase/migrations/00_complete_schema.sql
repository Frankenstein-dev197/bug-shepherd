-- =============================================
-- Bug Shepherd - Complete Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- HELPER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PROJECTS TABLE
-- =============================================
CREATE TYPE IF NOT EXISTS public.project_status AS ENUM ('active', 'archived');

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tracking_prefix text NOT NULL DEFAULT 'BUG',
  tracking_counter integer NOT NULL DEFAULT 0,
  status project_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects viewable by authenticated" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own projects" ON public.projects
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- BUGS TABLE
-- =============================================
CREATE TYPE IF NOT EXISTS public.bug_status AS ENUM ('new', 'assigned', 'in_progress', 'testing', 'resolved', 'closed');
CREATE TYPE IF NOT EXISTS public.bug_severity AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TABLE IF NOT EXISTS public.bugs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status bug_status NOT NULL DEFAULT 'new',
  severity bug_severity NOT NULL DEFAULT 'medium',
  tracking_id text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bugs viewable by authenticated" ON public.bugs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own bugs" ON public.bugs
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_bugs_updated_at
  BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate tracking ID
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
  prefix_text TEXT;
  new_counter INTEGER;
  tracking TEXT;
BEGIN
  -- Get the project's tracking prefix and increment counter
  UPDATE public.projects
  SET tracking_counter = tracking_counter + 1
  WHERE id = NEW.project_id
  RETURNING tracking_prefix, tracking_counter INTO prefix_text, new_counter;
  
  -- Handle case where no project is specified
  IF prefix_text IS NULL THEN
    prefix_text := 'BUG';
  END IF;
  
  -- Generate tracking ID
  NEW.tracking_id := prefix_text || '-' || LPAD(new_counter::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER generate_bug_tracking_id
  BEFORE INSERT ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.generate_tracking_id();

-- =============================================
-- GIT PROVIDER ENUM
-- =============================================
DO $$ BEGIN
  CREATE TYPE public.git_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- GIT REPOS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_repos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider git_provider NOT NULL DEFAULT 'github',
  full_name text NOT NULL,
  html_url text NOT NULL DEFAULT '',
  default_branch text NOT NULL DEFAULT 'main',
  is_active boolean NOT NULL DEFAULT true,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.git_repos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Repos viewable by authenticated" ON public.git_repos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own repos" ON public.git_repos
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_git_repos_updated_at
  BEFORE UPDATE ON public.git_repos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- GIT EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE public.git_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by authenticated" ON public.git_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage events" ON public.git_events
  FOR ALL TO service_role USING (true);

-- =============================================
-- GIT OAUTH TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider git_provider NOT NULL,
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

ALTER TABLE public.git_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own git tokens" ON public.git_oauth_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_git_oauth_tokens_updated_at
  BEFORE UPDATE ON public.git_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- GIT WEBHOOKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_webhooks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_id uuid NOT NULL REFERENCES public.git_repos(id) ON DELETE CASCADE,
  external_hook_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.git_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage webhooks for own repos" ON public.git_webhooks
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
  );

-- =============================================
-- API KEYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own api keys" ON public.api_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- API KEY USAGE TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.api_key_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT 'GET',
  status_code integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view usage of own keys" ON public.api_key_usage
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND k.user_id = auth.uid())
  );

-- =============================================
-- INSERT DEFAULT PROJECT FOR NEW USERS
-- =============================================
CREATE OR REPLACE FUNCTION public.create_default_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (user_id, name, tracking_prefix)
  VALUES (NEW.id, 'My Project', 'BUG');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_user_created_default_project
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_project();

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
SELECT '✅ Database schema created successfully!' AS message;
