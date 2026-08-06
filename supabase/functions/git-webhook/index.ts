// Receives GitHub / GitLab / Bitbucket webhooks and records workflow events.
// URL: <functions-base>/git-webhook?repo_id=<uuid>
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ParsedEvent = {
  event_type: string;
  actor: string;
  message: string;
  commit_sha: string;
  branch: string;
  html_url: string;
};

function parsePayload(provider: string, headers: Headers, payload: any): ParsedEvent {
  if (provider === "gitlab") {
    const kind = String(payload?.object_kind ?? "unknown");
    const commit = payload?.commits?.[payload.commits.length - 1];
    return {
      event_type: kind === "merge_request" ? "pull_request" : kind,
      actor: payload?.user_name ?? payload?.user?.name ?? "",
      message: payload?.object_attributes?.title ?? commit?.message ?? "",
      commit_sha: String(payload?.checkout_sha ?? commit?.id ?? "").slice(0, 40),
      branch: String(payload?.ref ?? "").replace("refs/heads/", ""),
      html_url: payload?.object_attributes?.url ?? commit?.url ?? "",
    };
  }
  if (provider === "bitbucket") {
    const change = payload?.push?.changes?.[0];
    const commit = change?.new?.target;
    return {
      event_type: payload?.pullrequest ? "pull_request" : "push",
      actor: payload?.actor?.display_name ?? "",
      message: payload?.pullrequest?.title ?? commit?.message ?? "",
      commit_sha: String(commit?.hash ?? "").slice(0, 40),
      branch: change?.new?.name ?? "",
      html_url: payload?.pullrequest?.links?.html?.href ?? commit?.links?.html?.href ?? "",
    };
  }
  // GitHub
  const ghEvent = headers.get("x-github-event") ?? "push";
  const head = payload?.head_commit ?? payload?.commits?.[payload?.commits?.length - 1];
  return {
    event_type: ghEvent,
    actor: payload?.sender?.login ?? payload?.pusher?.name ?? "",
    message: payload?.pull_request?.title ?? payload?.issue?.title ?? head?.message ?? "",
    commit_sha: String(payload?.after ?? head?.id ?? "").slice(0, 40),
    branch: String(payload?.ref ?? "").replace("refs/heads/", ""),
    html_url: payload?.pull_request?.html_url ?? head?.url ?? payload?.compare ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const repoId = url.searchParams.get("repo_id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(repoId)) return json({ error: "Valid repo_id is required" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: repo } = await db
      .from("git_repos")
      .select("id, provider, is_active")
      .eq("id", repoId)
      .maybeSingle();
    if (!repo) return json({ error: "Unknown repository" }, 404);
    if (!repo.is_active) return json({ error: "Repository is paused" }, 403);

    const raw = await req.text();
    if (raw.length > 1_000_000) return json({ error: "Payload too large" }, 413);
    let payload: any = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON payload" }, 400);
    }

    const parsed = parsePayload(String(repo.provider), req.headers, payload);

    // Link the event to a bug when the message references a tracking id (BUG-00012).
    let bugId: string | null = null;
    const ref = parsed.message.match(/BUG-\d{1,10}/i);
    if (ref) {
      const { data: bug } = await db
        .from("bugs")
        .select("id")
        .eq("tracking_id", ref[0].toUpperCase())
        .maybeSingle();
      bugId = bug?.id ?? null;
    }

    const { error } = await db.from("git_events").insert({
      repo_id: repoId,
      bug_id: bugId,
      event_type: parsed.event_type.slice(0, 40),
      actor: parsed.actor.slice(0, 120),
      message: parsed.message.slice(0, 2000),
      commit_sha: parsed.commit_sha,
      branch: parsed.branch.slice(0, 200),
      html_url: parsed.html_url.slice(0, 1000),
    });
    if (error) return json({ error: error.message }, 400);

    await db.from("git_repos").update({ last_event_at: new Date().toISOString() }).eq("id", repoId);

    return json({ ok: true, linked_bug: bugId });
  } catch (e) {
    console.error("git-webhook error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});