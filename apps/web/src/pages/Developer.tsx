import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  KeyRound, Terminal, GitBranch, BookOpen, Copy, Trash2, Ban,
  Loader2, Plus, RefreshCw, ExternalLink, Server,
} from "lucide-react";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const SCOPES = [
  { id: "bugs:read", label: "Read bugs" },
  { id: "bugs:write", label: "Create & update bugs" },
  { id: "projects:read", label: "Read projects" },
  { id: "analytics:read", label: "Read analytics" },
];

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
      <p className="text-[12px] text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── API keys ───────────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["bugs:read"]);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load keys", description: error.message, variant: "destructive" });
    setKeys(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    if (scopes.length === 0) {
      toast({ title: "Pick at least one permission", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("api-keys", {
      body: { action: "create", name, scopes },
    });
    setCreating(false);
    if (error || data?.error) {
      toast({ title: "Key creation failed", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    setRevealed(data.secret);
    setName("");
    load();
  };

  const act = async (action: string, id: string) => {
    const { data, error } = await supabase.functions.invoke("api-keys", { body: { action, id } });
    if (error || data?.error) {
      toast({ title: "Action failed", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: action === "revoke" ? "Key revoked" : "Key deleted" });
    load();
  };

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="API keys"
        description="Authenticate external tools, CI pipelines and scripts against the Triage API."
      />

      {revealed && (
        <div className="border border-primary/40 bg-primary/5 rounded-md p-3 space-y-2">
          <p className="text-[12px] font-medium text-foreground">
            Copy this key now — it is shown only once and is never stored in readable form.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono bg-muted px-2 py-1.5 rounded break-all">{revealed}</code>
            <Button size="sm" variant="outline" className="h-8" onClick={() => copy(revealed)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => setRevealed(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-md p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-[12px]">Key name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI pipeline"
            maxLength={60}
            className="h-8 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Permissions</Label>
          <div className="grid grid-cols-2 gap-2">
            {SCOPES.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Checkbox
                  checked={scopes.includes(s.id)}
                  onCheckedChange={(checked) =>
                    setScopes((prev) => (checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <Button size="sm" className="h-8 text-[13px]" onClick={createKey} disabled={creating}>
          {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Create key
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : keys.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No API keys yet.</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 border border-border rounded-md px-3 py-2">
              <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-foreground truncate">{k.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {k.key_prefix}_••••{k.key_last4} · {(k.scopes ?? []).join(", ")}
                </p>
              </div>
              <Badge variant={k.revoked_at ? "secondary" : "default"} className="text-[10px]">
                {k.revoked_at ? "revoked" : "active"}
              </Badge>
              {!k.revoked_at && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => act("revoke", k.id)}>
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => act("delete", k.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Console ────────────────────────────────────────────────────────────────────

type Line = { kind: "input" | "output" | "error"; text: string };

function ConsoleTab() {
  const [lines, setLines] = useState<Line[]>([
    { kind: "output", text: 'Triage console ready. Type "help" to list commands.' },
  ]);
  const [value, setValue] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    supabase
      .from("console_history")
      .select("command")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setHistory((data ?? []).map((r: any) => r.command)));
  }, []);

  const run = async () => {
    const command = value.trim();
    if (!command || running) return;
    setValue("");
    setHistory((h) => [command, ...h]);
    setHistoryIdx(-1);

    if (command === "clear") {
      setLines([]);
      return;
    }

    setLines((l) => [...l, { kind: "input", text: command }]);
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("dev-console", { body: { command } });
    setRunning(false);

    if (error) {
      setLines((l) => [...l, { kind: "error", text: `error: ${error.message}` }]);
      return;
    }
    setLines((l) => [...l, { kind: data.success ? "output" : "error", text: data.output }]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      if (next >= 0) { setHistoryIdx(next); setValue(history[next]); }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setValue(next >= 0 ? history[next] : "");
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Console"
        description="Commands execute on the server with your own permissions. Arrow keys browse history."
      />

      <div
        className="border border-border rounded-md bg-sidebar overflow-hidden cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex items-center gap-1.5 px-3 h-8 border-b border-border">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-mono">triage@console</span>
        </div>
        <div ref={scrollRef} className="h-[420px] overflow-auto p-3 space-y-1 font-mono text-[12px] leading-relaxed">
          {lines.map((line, i) => (
            <pre
              key={i}
              className={
                line.kind === "input"
                  ? "text-primary whitespace-pre-wrap"
                  : line.kind === "error"
                  ? "text-destructive whitespace-pre-wrap"
                  : "text-foreground whitespace-pre-wrap"
              }
            >
              {line.kind === "input" ? `$ ${line.text}` : line.text}
            </pre>
          ))}
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <div className="flex items-center gap-1.5">
            <span className="text-primary">$</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent outline-none border-0 text-foreground font-mono text-[12px]"
            />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-md p-3 flex items-start gap-2">
        <Server className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[12px] text-muted-foreground">
          This console runs a safe, whitelisted command set against your backend. A full Linux shell and
          a VS Code Server need a persistent container — connect an external compute provider
          (Fly.io, E2B, Coder) to enable those.
        </p>
      </div>
    </div>
  );
}

// ─── Git ────────────────────────────────────────────────────────────────────────

function GitTab() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("github");
  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState("main");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from("git_repos").select("*").order("created_at", { ascending: false }),
      supabase
        .from("git_events")
        .select("*, git_repos(full_name, provider)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setRepos(r ?? []);
    setEvents(e ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hostFor = (p: string) =>
    p === "gitlab" ? "https://gitlab.com/" : p === "bitbucket" ? "https://bitbucket.org/" : "https://github.com/";

  const addRepo = async () => {
    const name = fullName.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) {
      toast({ title: "Use the owner/repository format", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("git_repos").insert({
      user_id: user!.id,
      provider: provider as any,
      full_name: name,
      html_url: `${hostFor(provider)}${name}`,
      default_branch: branch.trim() || "main",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not connect repository", description: error.message, variant: "destructive" });
      return;
    }
    setFullName("");
    toast({ title: "Repository connected", description: "Add the webhook URL to finish the setup." });
    load();
  };

  const toggleRepo = async (id: string, isActive: boolean) => {
    await supabase.from("git_repos").update({ is_active: isActive }).eq("id", id);
    load();
  };

  const removeRepo = async (id: string) => {
    const { error } = await supabase.from("git_repos").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const copyWebhook = (id: string) => {
    navigator.clipboard.writeText(`${FUNCTIONS_BASE}/git-webhook?repo_id=${id}`);
    toast({ title: "Webhook URL copied", description: "Paste it into your provider's webhook settings." });
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Git repositories"
        description="Connect GitHub, GitLab or Bitbucket and follow pushes and pull requests next to your bugs."
      />

      <div className="border border-border rounded-md p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[12px]">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="gitlab">GitLab</SelectItem>
                <SelectItem value="bitbucket">Bitbucket</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px]">Repository</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="acme/web-app"
              className="h-8 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px]">Default branch</Label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} className="h-8 text-[13px]" />
          </div>
        </div>
        <Button size="sm" className="h-8 text-[13px]" onClick={addRepo} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <GitBranch className="mr-1.5 h-3.5 w-3.5" />}
          Connect repository
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : repos.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No repository connected yet.</p>
        ) : (
          repos.map((r) => (
            <div key={r.id} className="border border-border rounded-md px-3 py-2 space-y-2">
              <div className="flex items-center gap-3">
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground truncate">{r.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.provider} · {r.default_branch}
                    {r.last_event_at ? ` · last event ${new Date(r.last_event_at).toLocaleString()}` : ""}
                  </p>
                </div>
                {r.html_url && (
                  <a href={r.html_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Switch checked={r.is_active} onCheckedChange={(v) => toggleRepo(r.id, v)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRepo(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => copyWebhook(r.id)}>
                <Copy className="mr-1.5 h-3 w-3" /> Copy webhook URL
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionTitle title="Workflow activity" description="Events received from your connected repositories." />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {events.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No events yet. Add the webhook URL to your repository settings, then push a commit.
            Mention a tracking id such as <code className="font-mono">BUG-00001</code> in the commit message
            to link it to that bug automatically.
          </p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="border border-border rounded-md px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{e.event_type}</Badge>
                <span className="text-[12px] text-foreground">{e.actor || "unknown"}</span>
                {e.branch && <span className="text-[11px] font-mono text-muted-foreground">{e.branch}</span>}
                {e.commit_sha && (
                  <span className="text-[11px] font-mono text-muted-foreground">{e.commit_sha.slice(0, 7)}</span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground mt-1 truncate">{e.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Docs ───────────────────────────────────────────────────────────────────────

function DocsTab() {
  const base = `${FUNCTIONS_BASE}/api-v1`;
  const snippet = `curl "${base}/bugs?status=new&limit=10" \\
  -H "Authorization: Bearer trg_live_YOUR_KEY"

curl -X POST "${base}/bugs" \\
  -H "Authorization: Bearer trg_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Checkout fails on Safari","severity":"high"}'`;

  return (
    <div className="space-y-6">
      <SectionTitle title="API reference" description="Base URL and endpoints available with your API keys." />

      <div className="border border-border rounded-md p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Base URL</p>
        <code className="text-[12px] font-mono text-foreground break-all">{base}</code>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {[
          ["GET", "/bugs", "List bugs. Filters: status, severity, limit.", "bugs:read"],
          ["GET", "/bugs/:id", "One bug by UUID or tracking id.", "bugs:read"],
          ["POST", "/bugs", "Report a bug.", "bugs:write"],
          ["PATCH", "/bugs/:id", "Update title, status or severity.", "bugs:write"],
          ["GET", "/projects", "List projects.", "projects:read"],
          ["GET", "/stats", "Counts by status and severity.", "analytics:read"],
        ].map(([method, path, desc, scope]) => (
          <div key={`${method}${path}`} className="flex items-start gap-3 px-3 py-2">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{method}</Badge>
            <div className="min-w-0 flex-1">
              <code className="text-[12px] font-mono text-foreground">{path}</code>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{scope}</Badge>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-foreground">Examples</p>
        <pre className="border border-border rounded-md bg-sidebar p-3 text-[11px] font-mono overflow-auto whitespace-pre text-muted-foreground">
{snippet}
        </pre>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function Developer() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-0.5">
          <h1 className="text-[18px] font-semibold text-foreground">Developer</h1>
          <p className="text-[13px] text-muted-foreground">
            API keys, console, and Git workflow integrations for Triage.
          </p>
        </header>

        <Tabs defaultValue="keys">
          <TabsList className="h-9 p-0.5">
            <TabsTrigger value="keys" className="text-[12px] gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> API keys
            </TabsTrigger>
            <TabsTrigger value="console" className="text-[12px] gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> Console
            </TabsTrigger>
            <TabsTrigger value="git" className="text-[12px] gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Git
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-[12px] gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> API docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="mt-5"><ApiKeysTab /></TabsContent>
          <TabsContent value="console" className="mt-5"><ConsoleTab /></TabsContent>
          <TabsContent value="git" className="mt-5"><GitTab /></TabsContent>
          <TabsContent value="docs" className="mt-5"><DocsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}