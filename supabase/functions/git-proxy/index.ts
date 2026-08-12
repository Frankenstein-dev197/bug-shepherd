// Authenticated Git smart-HTTP relay.
//
// The browser Git engine (isomorphic-git) points its `corsProxy` at this
// function. We authenticate the app user, look up that user's stored token for
// the target host, and inject the Authorization header server-side, so the
// access token never reaches the browser. Only Git smart-HTTP endpoints are
// relayed.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type, accept, accept-encoding, git-protocol, user-agent, pragma, cache-control",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-type, content-length, www-authenticate",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const ALLOWED_SUFFIXES = ["/info/refs", "/git-upload-pack", "/git-receive-pack"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    // /functions/v1/git-proxy/<host>/<repo path>/<git endpoint>
    const marker = "/git-proxy/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return json({ error: "Bad proxy path" }, 400);
    const rest = url.pathname.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return json({ error: "Bad proxy path" }, 400);

    const host = rest.slice(0, slash).toLowerCase();
    const repoPath = rest.slice(slash);
    if (!ALLOWED_SUFFIXES.some((s) => repoPath.endsWith(s))) {
      return json({ error: "Only Git smart-HTTP endpoints can be proxied" }, 403);
    }
    if (!/^[a-z0-9.-]+(:\d+)?$/.test(host)) return json({ error: "Invalid host" }, 400);

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
    const { data: cred } = await db
      .from("git_credentials")
      .select("username, access_token")
      .eq("user_id", user.id)
      .eq("host", host)
      .maybeSingle();

    const target = `https://${host}${repoPath}${url.search}`;
    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const accept = req.headers.get("accept");
    if (accept) headers.set("accept", accept);
    const gitProtocol = req.headers.get("git-protocol");
    if (gitProtocol) headers.set("git-protocol", gitProtocol);
    headers.set("user-agent", "git/isomorphic-git");

    if (cred?.access_token) {
      const basic = btoa(`${cred.username || "oauth2"}:${cred.access_token}`);
      headers.set("authorization", `Basic ${basic}`);
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "POST" ? new Uint8Array(await req.arrayBuffer()) : undefined,
      redirect: "follow",
    });

    if (upstream.status === 401 || upstream.status === 403) {
      console.error(`Git proxy auth failure [${upstream.status}] for ${host}${repoPath}`);
    }

    const outHeaders = new Headers(CORS);
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) outHeaders.set("content-type", upstreamType);
    const wwwAuth = upstream.headers.get("www-authenticate");
    if (wwwAuth) outHeaders.set("www-authenticate", wwwAuth);

    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch (e) {
    console.error("git-proxy error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
