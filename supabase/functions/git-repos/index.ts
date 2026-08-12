// Git repositories API - lists repositories from connected GitHub/GitLab accounts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface RepoListItem {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
  provider: string;
  provider_username: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the user from the request headers
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Get all OAuth tokens for the user
    const { data: tokens, error: tokensError } = await db
      .from("git_credentials")
      .select("*")
      .eq("user_id", user.id);

    if (tokensError) return json({ error: "Failed to fetch tokens" }, 500);
    if (!tokens || tokens.length === 0) {
      return json({ repos: [], message: "No GitHub or GitLab accounts connected" });
    }

    const repos: RepoListItem[] = [];

    // Fetch repos from each provider
    for (const token of tokens) {
      if (token.provider === "github") {
        try {
          const ghRepos = await fetchGitHubRepos(token.access_token, token.provider_username || token.username);
          repos.push(...ghRepos);
        } catch (e) {
          console.error("Failed to fetch GitHub repos:", e);
        }
      } else if (token.provider === "gitlab") {
        try {
          const glRepos = await fetchGitLabRepos(token.access_token, token.provider_username || token.username);
          repos.push(...glRepos);
        } catch (e) {
          console.error("Failed to fetch GitLab repos:", e);
        }
      }
    }

    // Sort by name
    repos.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return json({ repos });
  } catch (e) {
    console.error("Git repos error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

async function fetchGitHubRepos(accessToken: string, username: string): Promise<RepoListItem[]> {
  const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data.map((repo: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    default_branch: string;
    private: boolean;
  }) => ({
    id: `github-${repo.id}`,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    default_branch: repo.default_branch,
    private: repo.private,
    provider: "github",
    provider_username: username,
  }));
}

async function fetchGitLabRepos(accessToken: string, username: string): Promise<RepoListItem[]> {
  const response = await fetch(
    "https://gitlab.com/api/v4/projects?membership=true&order_by=last_activity_at&per_page=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status}`);
  }

  const data = await response.json();
  return data.map((repo: {
    id: number;
    name: string;
    path_with_namespace: string;
    description: string | null;
    web_url: string;
    default_branch: string;
    visibility: string;
  }) => ({
    id: `gitlab-${repo.id}`,
    name: repo.name,
    full_name: repo.path_with_namespace,
    description: repo.description,
    html_url: repo.web_url,
    default_branch: repo.default_branch,
    private: repo.visibility === "private",
    provider: "gitlab",
    provider_username: username,
  }));
}
