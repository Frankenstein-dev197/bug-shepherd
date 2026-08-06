import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateApiKey, sha256Hex } from "../_shared/keys.ts";

const VALID_SCOPES = ["bugs:read", "bugs:write", "projects:read", "analytics:read"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "create") {
      const name = String(body.name ?? "").trim().slice(0, 60) || "Untitled key";
      const scopes: string[] = Array.isArray(body.scopes)
        ? body.scopes.filter((s: unknown) => VALID_SCOPES.includes(String(s)))
        : ["bugs:read"];
      if (scopes.length === 0) return json({ error: "At least one valid scope is required" }, 400);

      const { plain, prefix, last4 } = generateApiKey();
      const key_hash = await sha256Hex(plain);

      const { data, error } = await admin
        .from("api_keys")
        .insert({ user_id: userId, name, key_prefix: prefix, key_last4: last4, key_hash, scopes })
        .select("id, name, key_prefix, key_last4, scopes, created_at")
        .single();
      if (error) return json({ error: error.message }, 400);

      // The plaintext key is returned exactly once and never stored.
      return json({ key: data, secret: plain });
    }

    if (action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await admin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await admin.from("api_keys").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("api-keys error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});