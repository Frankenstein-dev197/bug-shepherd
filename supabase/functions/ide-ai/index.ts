// IDE AI assistant — streams-free chat completion via the Lovable AI Gateway.
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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) return json({ error: "messages is required" }, 400);

    const safeMessages = messages.slice(-30).map((m: { role?: string; content?: string }) => ({
      role: m?.role === "assistant" || m?.role === "system" ? m.role : "user",
      content: String(m?.content ?? "").slice(0, 20000),
    }));

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured" }, 500);

    const model = typeof body?.model === "string" ? body.model : "google/gemini-2.5-flash";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages: safeMessages }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`AI gateway failed [${res.status}]: ${details}`);
      return json({ error: "AI request failed", status: res.status, details }, res.status);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return json({ content, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    console.error("ide-ai error:", message);
    return json({ error: message }, 500);
  }
});
