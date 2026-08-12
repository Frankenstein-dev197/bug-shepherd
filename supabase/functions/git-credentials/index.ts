// Git credential vault.
// Tokens are stored server-side only (public.git_credentials, service-role access
// only) and are NEVER returned to the browser. The browser can list masked
// entries, save a token, or delete one.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeHost(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).host.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function providerOf(host: string): string {
  if (host.includes("github")) return "github";
  if (host.includes("gitlab")) return "gitlab";
  if (host.includes("bitbucket")) return "bitbucket";
  return "custom";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data, error } = await db
        .from("git_credentials")
        .select("host, provider, source, username, provider_username, scope, expires_at, updated_at")
        .eq("user_id", user.id)
        .order("host");
      if (error) return json({ error: error.message }, 500);
      return json({ credentials: data ?? [] });
    }

    if (action === "save") {
      const host = normalizeHost(body.host);
      const token = String(body.token ?? "").trim();
      if (!host) return json({ error: "host is required" }, 400);
      if (!token) return json({ error: "token is required" }, 400);

      const { error } = await db.from("git_credentials").upsert(
        {
          user_id: user.id,
          host,
          provider: body.provider ?? providerOf(host),
          source: "pat",
          username: String(body.username ?? "").trim() || "oauth2",
          access_token: token,
          scope: body.scope ?? null,
        },
        { onConflict: "user_id,host" },
      );
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, host });
    }

    if (action === "delete") {
      const host = normalizeHost(body.host);
      if (!host) return json({ error: "host is required" }, 400);
      const { error } = await db
        .from("git_credentials")
        .delete()
        .eq("user_id", user.id)
        .eq("host", host);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, host });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("git-credentials error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
