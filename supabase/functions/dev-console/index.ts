// Server-side command console. Executes a whitelisted command set with the
// caller's own permissions. No raw SQL is ever executed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const HELP = `Triage console — available commands

  help                      show this help
  whoami                    current user and roles
  bugs list [status]        list recent bugs (optionally filtered)
  bugs show <BUG-00001>     full detail for one bug
  bugs count                counts by status and severity
  projects list             list projects
  team list                 list team members
  keys list                 your API keys (masked)
  repos list                connected git repositories
  events [limit]            recent git workflow events
  clear                     clear the screen (local)

Commands run on the server with your own permissions.`;

function table(rows: string[][]): string {
  if (rows.length === 0) return "(no rows)";
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  return rows
    .map((r) => r.map((c, i) => (c ?? "").padEnd(widths[i])).join("  "))
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const command = String(body.command ?? "").trim().slice(0, 500);
    if (!command) return json({ error: "command is required" }, 400);

    const parts = command.split(/\s+/);
    const [cmd, sub, ...rest] = parts;
    let output = "";
    let success = true;

    switch (cmd.toLowerCase()) {
      case "help":
        output = HELP;
        break;

      case "whoami": {
        const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.id);
        const { data: profile } = await db
          .from("profiles")
          .select("full_name, job_title")
          .eq("user_id", user.id)
          .maybeSingle();
        output = [
          `email     ${user.email ?? "-"}`,
          `user_id   ${user.id}`,
          `name      ${profile?.full_name || "-"}`,
          `title     ${profile?.job_title || "-"}`,
          `roles     ${(roles ?? []).map((r: any) => r.role).join(", ") || "user"}`,
        ].join("\n");
        break;
      }

      case "bugs": {
        if (sub === "list") {
          let q = db
            .from("bugs")
            .select("tracking_id, title, severity, status, created_at")
            .order("created_at", { ascending: false })
            .limit(25);
          if (rest[0]) q = q.eq("status", rest[0]);
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          output = table([
            ["ID", "SEVERITY", "STATUS", "TITLE"],
            ...(data ?? []).map((b: any) => [
              b.tracking_id,
              b.severity,
              b.status,
              String(b.title).slice(0, 60),
            ]),
          ]);
        } else if (sub === "show") {
          const ref = (rest[0] ?? "").toUpperCase();
          if (!/^BUG-\d+$/.test(ref)) throw new Error("Usage: bugs show BUG-00001");
          const { data, error } = await db
            .from("bugs")
            .select("*")
            .eq("tracking_id", ref)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error(`No bug found with id ${ref}`);
          output = Object.entries(data)
            .map(([k, v]) => `${k.padEnd(20)}${v === null ? "-" : String(v)}`)
            .join("\n");
        } else if (sub === "count") {
          const { data, error } = await db.from("bugs").select("status, severity");
          if (error) throw new Error(error.message);
          const byStatus: Record<string, number> = {};
          const bySeverity: Record<string, number> = {};
          for (const r of data ?? []) {
            byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
            bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
          }
          output = [
            `total ${data?.length ?? 0}`,
            "",
            "by status",
            table(Object.entries(byStatus).map(([k, v]) => [k, String(v)])),
            "",
            "by severity",
            table(Object.entries(bySeverity).map(([k, v]) => [k, String(v)])),
          ].join("\n");
        } else {
          throw new Error("Usage: bugs list|show|count");
        }
        break;
      }

      case "projects": {
        const { data, error } = await db.from("projects").select("name, description, created_at");
        if (error) throw new Error(error.message);
        output = table([
          ["NAME", "DESCRIPTION"],
          ...(data ?? []).map((p: any) => [p.name, String(p.description ?? "").slice(0, 60)]),
        ]);
        break;
      }

      case "team": {
        const { data, error } = await db.rpc("get_team_members");
        if (error) throw new Error(error.message);
        output = table([
          ["NAME", "ROLE", "TITLE"],
          ...(data ?? []).map((m: any) => [m.full_name || "-", m.role, m.job_title || "-"]),
        ]);
        break;
      }

      case "keys": {
        const { data, error } = await db
          .from("api_keys")
          .select("name, key_prefix, key_last4, scopes, revoked_at, last_used_at")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        output = table([
          ["NAME", "KEY", "SCOPES", "STATE"],
          ...(data ?? []).map((k: any) => [
            k.name,
            `${k.key_prefix}_****${k.key_last4}`,
            (k.scopes ?? []).join(","),
            k.revoked_at ? "revoked" : "active",
          ]),
        ]);
        break;
      }

      case "repos": {
        const { data, error } = await db
          .from("git_repos")
          .select("provider, full_name, default_branch, is_active, last_event_at");
        if (error) throw new Error(error.message);
        output = table([
          ["PROVIDER", "REPOSITORY", "BRANCH", "STATE"],
          ...(data ?? []).map((r: any) => [
            r.provider,
            r.full_name,
            r.default_branch,
            r.is_active ? "active" : "paused",
          ]),
        ]);
        break;
      }

      case "events": {
        const limit = Math.min(Number(sub) || 20, 100);
        const { data, error } = await db
          .from("git_events")
          .select("event_type, actor, branch, message, commit_sha, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error(error.message);
        output = table([
          ["EVENT", "ACTOR", "BRANCH", "MESSAGE"],
          ...(data ?? []).map((e: any) => [
            e.event_type,
            e.actor || "-",
            e.branch || "-",
            String(e.message ?? "").split("\n")[0].slice(0, 60),
          ]),
        ]);
        break;
      }

      default:
        success = false;
        output = `command not found: ${cmd}\nType "help" to list available commands.`;
    }

    const duration = Date.now() - started;
    await db.from("console_history").insert({
      user_id: user.id,
      command,
      output: output.slice(0, 4000),
      success,
      duration_ms: duration,
    });

    return json({ output, success, duration_ms: duration });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("dev-console error", message);
    return json({ output: `error: ${message}`, success: false, duration_ms: Date.now() - started });
  }
});