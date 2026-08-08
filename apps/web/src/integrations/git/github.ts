// GitHub API integration service

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
    type: string;
  };
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubApi {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get the authenticated user
   */
  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  /**
   * Get all repositories for the authenticated user
   */
  async getRepositories(): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.request<GitHubRepo[]>(
        `/user/repos?sort=updated&per_page=${perPage}&page=${page}`
      );
      repos.push(...response);
      if (response.length < perPage) break;
      page++;
    }

    return repos;
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  /**
   * Create a webhook for a repository
   */
  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    secret?: string
  ): Promise<{ id: number; url: string }> {
    const response = await this.request<{ id: number; url: string }>(`/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push", "pull_request", "create"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: secret || undefined,
          insecure_ssl: "0",
        },
      }),
    });
    return response;
  }

  /**
   * List webhooks for a repository
   */
  async listWebhooks(owner: string, repo: string): Promise<Array<{ id: number; url: string; active: boolean }>> {
    return this.request<Array<{ id: number; url: string; active: boolean }>>(`/repos/${owner}/${repo}/hooks`);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, { method: "DELETE" });
  }
}

/**
 * Get the OAuth authorization URL for GitHub
 */
export function getGitHubOAuthUrl(redirectUri: string, state?: string): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GITHUB_CLIENT_ID is not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo,admin:repo_hook",
    ...(state && { state }),
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Exchange authorization code for access token (should be done server-side)
 */
export async function exchangeGitHubCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  // This should be called via a Supabase Edge Function for security
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/github-oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to exchange code" }));
    throw new Error(error.message);
  }

  return response.json();
}
