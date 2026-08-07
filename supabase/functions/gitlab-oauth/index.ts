// GitLab OAuth callback handler
// Exchanges authorization code for access token and stores it in the database
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { code, redirect_uri } = await req.json();
    if (!code) return json({ error: "Authorization code is required" }, 400);

    // Get environment variables
    const gitlabClientId = Deno.env.get("GITLAB_CLIENT_ID");
    const gitlabClientSecret = Deno.env.get("GITLAB_CLIENT_SECRET");

    if (!gitlabClientId || !gitlabClientSecret) {
      return json({ error: "GitLab OAuth is not configured" }, 500);
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://gitlab.com/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: gitlabClientId,
        client_secret: gitlabClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      return json({ error: tokenData.error_description || tokenData.error }, 400);
    }

    // Get the authenticated user to verify the token
    const userResponse = await fetch("https://gitlab.com/api/v4/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return json({ error: "Failed to verify GitLab authentication" }, 400);
    }

    const gitlabUser = await userResponse.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the request headers (set by Supabase auth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Store or update the GitLab token
    const { error: upsertError } = await db.from("git_oauth_tokens").upsert(
      {
        user_id: user.id,
        provider: "gitlab",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        scope: tokenData.scope,
        provider_user_id: String(gitlabUser.id),
        provider_username: gitlabUser.username,
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Failed to store GitLab token:", upsertError);
      return json({ error: "Failed to store authentication" }, 500);
    }

    return json({
      success: true,
      username: gitlabUser.username,
      avatar_url: gitlabUser.avatar_url,
    });
  } catch (e) {
    console.error("GitLab OAuth error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
