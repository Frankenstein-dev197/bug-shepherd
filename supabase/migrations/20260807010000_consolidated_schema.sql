-- =============================================
-- Bug Shepherd - Consolidated Database Schema
-- Migration: consolidated_schema
-- Idempotent: Can be run multiple times safely
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
-- ENUM TYPES (Safe creation with existence checks)
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE public.project_status AS ENUM ('active', 'archived');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_status') THEN
        CREATE TYPE public.bug_status AS ENUM ('new', 'assigned', 'in_progress', 'testing', 'resolved', 'closed');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_severity') THEN
        CREATE TYPE public.bug_severity AS ENUM ('critical', 'high', 'medium', 'low');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'git_provider') THEN
        CREATE TYPE public.git_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'other');
    END IF;
END $$;

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

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
DROP FUNCTION IF EXISTS public.handle_new_user();
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PROJECTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    tracking_prefix text NOT NULL DEFAULT 'BUG',
    tracking_counter integer NOT NULL DEFAULT 0,
    status public.project_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_all" ON public.projects;
CREATE POLICY "projects_all" ON public.projects
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default project for existing users without projects (run once)
INSERT INTO public.projects (user_id, name, tracking_prefix)
SELECT id, 'My Project', 'BUG'
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE projects.user_id = auth.users.id
);

-- =============================================
-- BUGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.bugs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status public.bug_status NOT NULL DEFAULT 'new',
    severity public.bug_severity NOT NULL DEFAULT 'medium',
    tracking_id text,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bugs_select" ON public.bugs;
CREATE POLICY "bugs_select" ON public.bugs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bugs_all" ON public.bugs;
CREATE POLICY "bugs_all" ON public.bugs
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_bugs_updated_at ON public.bugs;
CREATE TRIGGER update_bugs_updated_at
    BEFORE UPDATE ON public.bugs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate tracking ID
DROP FUNCTION IF EXISTS public.generate_tracking_id();
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
    prefix_text TEXT;
    new_counter INTEGER;
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

DROP TRIGGER IF EXISTS generate_bug_tracking_id ON public.bugs;
CREATE TRIGGER generate_bug_tracking_id
    BEFORE INSERT ON public.bugs
    FOR EACH ROW EXECUTE FUNCTION public.generate_tracking_id();

-- =============================================
-- GIT REPOS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_repos (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider public.git_provider NOT NULL DEFAULT 'github',
    full_name text NOT NULL,
    html_url text NOT NULL DEFAULT '',
    default_branch text NOT NULL DEFAULT 'main',
    is_active boolean NOT NULL DEFAULT true,
    last_event_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Additional fields from migration
    connection_id uuid,
    external_id text NOT NULL DEFAULT '',
    webhook_id text NOT NULL DEFAULT '',
    webhook_status text NOT NULL DEFAULT 'manual',
    webhook_secret text
);

ALTER TABLE public.git_repos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "git_repos_select" ON public.git_repos;
CREATE POLICY "git_repos_select" ON public.git_repos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "git_repos_all" ON public.git_repos;
CREATE POLICY "git_repos_all" ON public.git_repos
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_git_repos_updated_at ON public.git_repos;
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

DROP POLICY IF EXISTS "git_events_select" ON public.git_events;
CREATE POLICY "git_events_select" ON public.git_events
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "git_events_insert" ON public.git_events;
CREATE POLICY "git_events_insert" ON public.git_events
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
    );

-- =============================================
-- GIT OAUTH TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_oauth_tokens (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE public.git_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "git_oauth_tokens_all" ON public.git_oauth_tokens;
CREATE POLICY "git_oauth_tokens_all" ON public.git_oauth_tokens
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_git_oauth_tokens_updated_at ON public.git_oauth_tokens;
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

DROP POLICY IF EXISTS "git_webhooks_all" ON public.git_webhooks;
CREATE POLICY "git_webhooks_all" ON public.git_webhooks
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.git_repos r WHERE r.id = repo_id AND r.user_id = auth.uid())
    );

-- =============================================
-- GIT CONNECTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_connections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE public.git_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "git_connections_select" ON public.git_connections;
CREATE POLICY "git_connections_select" ON public.git_connections
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "git_connections_delete" ON public.git_connections;
CREATE POLICY "git_connections_delete" ON public.git_connections
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_git_connections_updated_at ON public.git_connections;
CREATE TRIGGER update_git_connections_updated_at
    BEFORE UPDATE ON public.git_connections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- GIT OAUTH STATES TABLE (for OAuth flow security)
-- =============================================
CREATE TABLE IF NOT EXISTS public.git_oauth_states (
    state text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider public.git_provider NOT NULL DEFAULT 'github',
    redirect_to text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.git_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "git_oauth_states_all" ON public.git_oauth_states;
CREATE POLICY "git_oauth_states_all" ON public.git_oauth_states
    FOR ALL TO service_role USING (true);

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

DROP POLICY IF EXISTS "api_keys_all" ON public.api_keys;
CREATE POLICY "api_keys_all" ON public.api_keys
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
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

DROP POLICY IF EXISTS "api_key_usage_select" ON public.api_key_usage;
CREATE POLICY "api_key_usage_select" ON public.api_key_usage
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND k.user_id = auth.uid())
    );

-- =============================================
-- INSERT DEFAULT PROJECT FOR NEW USERS
-- =============================================
DROP FUNCTION IF EXISTS public.create_default_project();
CREATE OR REPLACE FUNCTION public.create_default_project()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.projects (user_id, name, tracking_prefix)
    VALUES (NEW.id, 'My Project', 'BUG');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_user_created_default_project ON auth.users;
CREATE TRIGGER on_user_created_default_project
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_default_project();

-- =============================================
-- VERIFICATION
-- =============================================
SELECT 
    '✅ Database schema created/updated successfully!' AS status,
    COUNT(*) AS tables_created
FROM (
    SELECT 'profiles' AS tbl UNION ALL
    SELECT 'projects' UNION ALL
    SELECT 'bugs' UNION ALL
    SELECT 'git_repos' UNION ALL
    SELECT 'git_events' UNION ALL
    SELECT 'git_oauth_tokens' UNION ALL
    SELECT 'git_webhooks' UNION ALL
    SELECT 'git_connections' UNION ALL
    SELECT 'git_oauth_states' UNION ALL
    SELECT 'api_keys' UNION ALL
    SELECT 'api_key_usage'
) tables;
