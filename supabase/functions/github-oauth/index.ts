// GitHub OAuth callback handler
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
    const githubClientId = Deno.env.get("GITHUB_CLIENT_ID");
    const githubClientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");

    if (!githubClientId || !githubClientSecret) {
      return json({ error: "GitHub OAuth is not configured" }, 500);
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: githubClientId,
        client_secret: githubClientSecret,
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      return json({ error: tokenData.error_description || tokenData.error }, 400);
    }

    // Get the authenticated user to verify the token
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return json({ error: "Failed to verify GitHub authentication" }, 400);
    }

    const githubUser = await userResponse.json();

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

    // Store or update the GitHub token
    const { error: upsertError } = await db.from("git_oauth_tokens").upsert(
      {
        user_id: user.id,
        provider: "github",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        scope: tokenData.scope,
        provider_user_id: String(githubUser.id),
        provider_username: githubUser.login,
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Failed to store GitHub token:", upsertError);
      return json({ error: "Failed to store authentication" }, 500);
    }

    return json({
      success: true,
      username: githubUser.login,
      avatar_url: githubUser.avatar_url,
    });
  } catch (e) {
    console.error("GitHub OAuth error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
