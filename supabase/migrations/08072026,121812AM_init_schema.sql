-- =============================================
-- Bug Shepherd Database Schema
-- Migration: init_schema
-- Idempotent: Can be run multiple times safely
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ENUM TYPES
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

-- =============================================
-- AUTO-CREATE PROFILE FUNCTION
-- =============================================

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
    status project_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_all" ON public.projects;
CREATE POLICY "projects_all" ON public.projects
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- BUGS TABLE
-- =============================================

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

DROP POLICY IF EXISTS "bugs_all" ON public.bugs;
CREATE POLICY "bugs_all" ON public.bugs
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_bugs_updated_at ON public.bugs;
CREATE TRIGGER update_bugs_updated_at
    BEFORE UPDATE ON public.bugs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

DROP POLICY IF EXISTS "git_oauth_tokens_all" ON public.git_oauth_tokens;
CREATE POLICY "git_oauth_tokens_all" ON public.git_oauth_tokens
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_git_oauth_tokens_updated_at ON public.git_oauth_tokens;
CREATE TRIGGER update_git_oauth_tokens_updated_at
    BEFORE UPDATE ON public.git_oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE DEFAULT PROJECT FUNCTION
-- =============================================

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

SELECT '✅ Migration completed successfully' AS status;
