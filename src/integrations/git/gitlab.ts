// GitLab API integration service

export interface GitLabRepo {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  visibility: "private" | "internal" | "public";
  namespace: {
    id: number;
    name: string;
    path: string;
  };
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
}

const GITLAB_API_BASE = "https://gitlab.com/api/v4";

export class GitLabApi {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${GITLAB_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => [{ message: response.statusText }]);
      throw new Error((error as Array<{message?: string}>)[0]?.message || `GitLab API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get the authenticated user
   */
  async getUser(): Promise<GitLabUser> {
    return this.request<GitLabUser>("/user");
  }

  /**
   * Get all repositories for the authenticated user
   */
  async getRepositories(): Promise<GitLabRepo[]> {
    const repos: GitLabRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.request<GitLabRepo[]>(
        `/projects?membership=true&order_by=last_activity_at&per_page=${perPage}&page=${page}&simple=false`
      );
      repos.push(...response);
      if (response.length < perPage) break;
      page++;
    }

    return repos;
  }

  /**
   * Get repository details by ID
   */
  async getRepository(projectId: number | string): Promise<GitLabRepo> {
    return this.request<GitLabRepo>(`/projects/${encodeURIComponent(String(projectId))}`);
  }

  /**
   * Get repository by full path
   */
  async getRepositoryByPath(pathWithNamespace: string): Promise<GitLabRepo> {
    return this.request<GitLabRepo>(`/projects/${encodeURIComponent(pathWithNamespace)}`);
  }

  /**
   * Create a webhook for a project
   */
  async createWebhook(
    projectId: number | string,
    webhookUrl: string,
    secret?: string
  ): Promise<{ id: number; url: string }> {
    const response = await this.request<{ id: number; url: string }>(
      `/projects/${encodeURIComponent(String(projectId))}/hooks`,
      {
        method: "POST",
        body: JSON.stringify({
          url: webhookUrl,
          token: secret || undefined,
          push_events: true,
          merge_requests_events: true,
          tag_push_events: true,
          enable_ssl_verification: true,
        }),
      }
    );
    return response;
  }

  /**
   * List webhooks for a project
   */
  async listWebhooks(
    projectId: number | string
  ): Promise<Array<{ id: number; url: string; push_events: boolean; merge_requests_events: boolean }>> {
    return this.request<Array<{ id: number; url: string; push_events: boolean; merge_requests_events: boolean }>>(
      `/projects/${encodeURIComponent(String(projectId))}/hooks`
    );
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(projectId: number | string, hookId: number): Promise<void> {
    await this.request(`/projects/${encodeURIComponent(String(projectId))}/hooks/${hookId}`, {
      method: "DELETE",
    });
  }
}

/**
 * Get the OAuth authorization URL for GitLab
 */
export function getGitLabOAuthUrl(redirectUri: string, state?: string): string {
  const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GITLAB_CLIENT_ID is not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "api read_user read_repository write_repository",
    ...(state && { state }),
  });
  return `https://gitlab.com/oauth/authorize?${params}`;
}

/**
 * Exchange authorization code for access token (should be done server-side)
 */
export async function exchangeGitLabCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  // This should be called via a Supabase Edge Function for security
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/gitlab-oauth`, {
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
