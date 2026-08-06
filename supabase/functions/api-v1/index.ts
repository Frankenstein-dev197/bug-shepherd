// Public REST API for Triage, authenticated with a Triage API key.
// Usage: Authorization: Bearer trg_live_...
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sha256Hex } from "../_shared/keys.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = admin();
  const url = new URL(req.url);
  // Strip the function name so paths look like /bugs or /bugs/:id
  const path = url.pathname.replace(/^\/api-v1/, "").replace(/\/+$/, "") || "/";

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token.startsWith("trg_")) return json({ error: "Missing or malformed API key" }, 401);

    const hash = await sha256Hex(token);
    const { data: key } = await db
      .from("api_keys")
      .select("id, user_id, scopes, revoked_at, expires_at")
      .eq("key_hash", hash)
      .maybeSingle();

    if (!key) return json({ error: "Invalid API key" }, 401);
    if (key.revoked_at) return json({ error: "API key revoked" }, 401);
    if (key.expires_at && new Date(key.expires_at) < new Date())
      return json({ error: "API key expired" }, 401);

    const scopes: string[] = key.scopes ?? [];
    const log = async (status: number) => {
      await db.from("api_key_usage").insert({
        api_key_id: key.id,
        endpoint: path,
        method: req.method,
        status_code: status,
      });
      await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
    };

    const deny = async (msg: string, status: number) => {
      await log(status);
      return json({ error: msg }, status);
    };

    // GET /bugs
    if (path === "/bugs" && req.method === "GET") {
      if (!scopes.includes("bugs:read")) return deny("Scope bugs:read required", 403);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
      const status = url.searchParams.get("status");
      const severity = url.searchParams.get("severity");
      let q = db
        .from("bugs")
        .select("id, tracking_id, title, description, severity, status, environment, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      if (severity) q = q.eq("severity", severity);
      const { data, error } = await q;
      if (error) return deny(error.message, 400);
      await log(200);
      return json({ data });
    }

    // GET /bugs/:trackingIdOrUuid
    const bugMatch = path.match(/^\/bugs\/([\w-]+)$/);
    if (bugMatch && req.method === "GET") {
      if (!scopes.includes("bugs:read")) return deny("Scope bugs:read required", 403);
      const ref = bugMatch[1];
      const column = /^[0-9a-f-]{36}$/i.test(ref) ? "id" : "tracking_id";
      const { data, error } = await db.from("bugs").select("*").eq(column, ref).maybeSingle();
      if (error) return deny(error.message, 400);
      if (!data) return deny("Bug not found", 404);
      await log(200);
      return json({ data });
    }

    // POST /bugs
    if (path === "/bugs" && req.method === "POST") {
      if (!scopes.includes("bugs:write")) return deny("Scope bugs:write required", 403);
      const body = await req.json().catch(() => ({}));
      const title = String(body.title ?? "").trim();
      if (!title || title.length > 300) return deny("title is required (1-300 chars)", 400);
      const severity = ["critical", "high", "medium", "low"].includes(String(body.severity))
        ? String(body.severity)
        : "medium";
      const { data, error } = await db
        .from("bugs")
        .insert({
          title,
          description: String(body.description ?? "").slice(0, 10000),
          steps_to_reproduce: String(body.steps_to_reproduce ?? "").slice(0, 10000),
          environment: String(body.environment ?? "").slice(0, 300),
          severity,
          reporter_id: key.user_id,
        })
        .select("id, tracking_id, title, severity, status, created_at")
        .single();
      if (error) return deny(error.message, 400);
      await log(201);
      return json({ data }, 201);
    }

    // PATCH /bugs/:id
    if (bugMatch && req.method === "PATCH") {
      if (!scopes.includes("bugs:write")) return deny("Scope bugs:write required", 403);
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, unknown> = {};
      if (["new", "assigned", "in_progress", "testing", "resolved", "closed"].includes(String(body.status)))
        patch.status = body.status;
      if (["critical", "high", "medium", "low"].includes(String(body.severity)))
        patch.severity = body.severity;
      if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.slice(0, 300);
      if (Object.keys(patch).length === 0) return deny("No valid fields to update", 400);
      const ref = bugMatch[1];
      const column = /^[0-9a-f-]{36}$/i.test(ref) ? "id" : "tracking_id";
      const { data, error } = await db.from("bugs").update(patch).eq(column, ref).select("*").maybeSingle();
      if (error) return deny(error.message, 400);
      if (!data) return deny("Bug not found", 404);
      await log(200);
      return json({ data });
    }

    // GET /projects
    if (path === "/projects" && req.method === "GET") {
      if (!scopes.includes("projects:read")) return deny("Scope projects:read required", 403);
      const { data, error } = await db.from("projects").select("id, name, description, created_at");
      if (error) return deny(error.message, 400);
      await log(200);
      return json({ data });
    }

    // GET /stats
    if (path === "/stats" && req.method === "GET") {
      if (!scopes.includes("analytics:read")) return deny("Scope analytics:read required", 403);
      const { data, error } = await db.from("bugs").select("status, severity");
      if (error) return deny(error.message, 400);
      const byStatus: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      for (const row of data ?? []) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
      }
      await log(200);
      return json({ data: { total: data?.length ?? 0, by_status: byStatus, by_severity: bySeverity } });
    }

    if (path === "/" && req.method === "GET") {
      await log(200);
      return json({
        name: "Triage API v1",
        endpoints: [
          "GET /bugs", "GET /bugs/:id", "POST /bugs", "PATCH /bugs/:id",
          "GET /projects", "GET /stats",
        ],
        your_scopes: scopes,
      });
    }

    return deny("Endpoint not found", 404);
  } catch (e) {
    console.error("api-v1 error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});