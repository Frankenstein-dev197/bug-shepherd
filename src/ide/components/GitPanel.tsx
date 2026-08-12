import { useCallback, useEffect, useState } from 'react';
import {
  GitBranch as BranchIcon,
  GitCommit as CommitIcon,
  RefreshCw,
  Upload,
  Download,
  Check,
  Plus,
  KeyRound,
  Loader2,
  FolderGit2,
  Trash2,
} from 'lucide-react';
import * as G from '../lib/gitEngine';
import { getGitHubOAuthUrl, getGitLabOAuthUrl } from '@/integrations/git';

type Tab = 'changes' | 'branches' | 'history' | 'auth';

export function GitPanel() {
  const [tab, setTab] = useState<Tab>('changes');
  const [repos, setRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState<string | null>(null);
  const [branch, setBranch] = useState('');
  const [changes, setChanges] = useState<G.StatusEntry[]>([]);
  const [commits, setCommits] = useState<G.LogEntry[]>([]);
  const [branches, setBranches] = useState<{ local: string[]; remote: string[] }>({ local: [], remote: [] });
  const [remotes, setRemotes] = useState<{ remote: string; url: string }[]>([]);
  const [message, setMessage] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  // credentials form
  const [creds, setCreds] = useState<G.GitCredentialInfo[]>(G.cachedCredentials());
  const [credHost, setCredHost] = useState('github.com');
  const [credUser, setCredUser] = useState('');
  const [credToken, setCredToken] = useState('');
  const [author, setAuthorState] = useState(G.getAuthor());

  const refreshCreds = useCallback(async () => {
    try {
      setCreds(await G.listCredentials());
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Failed to load credentials', error: true });
    }
  }, []);

  useEffect(() => {
    void refreshCreds();
  }, [refreshCreds]);

  const startOAuth = (provider: 'github' | 'gitlab') => {
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem('oauth_state', state);
      const redirectUri = `${window.location.origin}/git/callback`;
      const url =
        provider === 'github'
          ? getGitHubOAuthUrl(redirectUri, state)
          : getGitLabOAuthUrl(redirectUri, state);
      window.location.href = url;
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : 'OAuth is not configured — use a personal access token',
        error: true,
      });
    }
  };

  const refreshRepos = useCallback(async () => {
    const list = await G.listRepos();
    setRepos(list);
    setRepo((current) => current ?? list[0] ?? null);
  }, []);

  const refreshRepo = useCallback(async (dir: string) => {
    setBranch(await G.currentBranch(dir));
    setChanges(await G.statusMatrix(dir));
    setBranches(await G.listBranches(dir));
    setRemotes(await G.listRemotes(dir));
    try {
      setCommits(await G.log(dir, 30));
    } catch {
      setCommits([]);
    }
  }, []);

  useEffect(() => {
    void refreshRepos();
  }, [refreshRepos]);

  useEffect(() => {
    if (repo) void refreshRepo(repo);
  }, [repo, refreshRepo]);

  const act = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setStatus(null);
    try {
      const result = await fn();
      if (result) setStatus({ text: result });
      if (repo) await refreshRepo(repo);
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusy(null);
    }
  };

  const handleClone = () =>
    act('clone', async () => {
      if (!cloneUrl.trim()) throw new Error('Enter a repository URL');
      const name = cloneUrl.replace(/\.git$/, '').split('/').pop() || 'repo';
      const dir = `${G.WORKSPACE}/${name}`;
      await G.cloneRepo({ url: cloneUrl.trim(), dir, onProgress: (m) => setStatus({ text: m }) });
      setCloneUrl('');
      await refreshRepos();
      setRepo(dir);
      return `Cloned into ${dir}`;
    });

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-2.5 py-1.5 text-[11px] uppercase tracking-wide ${
        tab === id ? 'text-[#cccccc] border-b-2 border-[#007acc]' : 'text-[#969696] hover:text-[#cccccc]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc] text-[12px]">
      {/* header */}
      <div className="px-3 py-2 border-b border-[#3c3c3c] space-y-2">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-[#007acc]" />
          <select
            value={repo ?? ''}
            onChange={(e) => setRepo(e.target.value || null)}
            className="flex-1 bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
          >
            {repos.length === 0 && <option value="">no repository</option>}
            {repos.map((r) => (
              <option key={r} value={r}>
                {r.replace(`${G.WORKSPACE}/`, '')}
              </option>
            ))}
          </select>
          <button
            title="Refresh"
            onClick={() => repo && void refreshRepo(repo)}
            className="p-1 hover:bg-[#3c3c3c] rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-1">
          <input
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="https://github.com/owner/repo.git"
            className="flex-1 bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none placeholder:text-[#7a7a7a]"
          />
          <button
            onClick={handleClone}
            disabled={busy === 'clone'}
            className="px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] rounded text-[11px] flex items-center gap-1 disabled:opacity-60"
          >
            {busy === 'clone' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Clone
          </button>
        </div>

        {repo && (
          <div className="flex items-center justify-between text-[11px] text-[#969696]">
            <span className="flex items-center gap-1">
              <BranchIcon className="w-3 h-3" /> {branch}
            </span>
            <span className="flex gap-1">
              <button
                onClick={() => act('pull', async () => (await G.pull(repo), 'Pull complete'))}
                disabled={!!busy}
                className="px-2 py-0.5 hover:bg-[#3c3c3c] rounded flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Pull
              </button>
              <button
                onClick={() =>
                  act('push', async () => {
                    const res = await G.push(repo);
                    if (res.error) throw new Error(res.error);
                    return 'Pushed to origin';
                  })
                }
                disabled={!!busy}
                className="px-2 py-0.5 hover:bg-[#3c3c3c] rounded flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Push
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="flex border-b border-[#3c3c3c]">
        {tabButton('changes', 'Changes')}
        {tabButton('branches', 'Branches')}
        {tabButton('history', 'History')}
        {tabButton('auth', 'Auth')}
      </div>

      {status && (
        <div className={`px-3 py-1.5 text-[11px] ${status.error ? 'text-[#f14c4c]' : 'text-[#3b8eea]'}`}>
          {status.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!repo && tab !== 'auth' && (
          <p className="p-3 text-[11px] text-[#969696]">
            Clone a repository above to start. Everything runs with a real Git engine in your browser.
          </p>
        )}

        {repo && tab === 'changes' && (
          <div className="p-2 space-y-2">
            <div className="flex gap-1">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Commit message"
                className="flex-1 bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none placeholder:text-[#7a7a7a]"
              />
              <button
                onClick={() =>
                  act('commit', async () => {
                    if (!message.trim()) throw new Error('Commit message required');
                    const oid = await G.commit(repo, message.trim());
                    setMessage('');
                    return `Committed ${oid.slice(0, 7)}`;
                  })
                }
                disabled={!!busy}
                className="px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] rounded text-[11px] flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Commit
              </button>
            </div>
            <button
              onClick={() => act('stageAll', async () => `Staged ${await G.stageAll(repo)} file(s)`)}
              disabled={!!busy}
              className="w-full px-2 py-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[11px] flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Stage all changes
            </button>

            {changes.length === 0 ? (
              <p className="text-[11px] text-[#969696] px-1 py-2">Working tree clean</p>
            ) : (
              <ul className="space-y-0.5">
                {changes.map((c) => (
                  <li key={c.path} className="flex items-center gap-2 px-1 py-1 hover:bg-[#2a2d2e] rounded">
                    <span
                      className={`w-4 text-center text-[10px] font-bold ${
                        c.status === 'untracked'
                          ? 'text-[#73c991]'
                          : c.status === 'deleted'
                            ? 'text-[#f14c4c]'
                            : 'text-[#e2c08d]'
                      }`}
                    >
                      {c.status === 'untracked' ? 'U' : c.status === 'deleted' ? 'D' : c.status === 'added' ? 'A' : 'M'}
                    </span>
                    <span className="flex-1 truncate text-[11px]" title={c.path}>
                      {c.path}
                    </span>
                    <button
                      title="Stage"
                      onClick={() => act('stage', () => G.stage(repo, c.path))}
                      className="p-0.5 hover:bg-[#3c3c3c] rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      title="Unstage"
                      onClick={() => act('unstage', () => G.unstage(repo, c.path))}
                      className="p-0.5 hover:bg-[#3c3c3c] rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {repo && tab === 'branches' && (
          <div className="p-2 space-y-2">
            <div className="flex gap-1">
              <input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="new-branch"
                className="flex-1 bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none placeholder:text-[#7a7a7a]"
              />
              <button
                onClick={() =>
                  act('branch', async () => {
                    if (!newBranch.trim()) throw new Error('Branch name required');
                    await G.createBranch(repo, newBranch.trim(), true);
                    setNewBranch('');
                    return 'Branch created and checked out';
                  })
                }
                className="px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] rounded text-[11px]"
              >
                Create
              </button>
            </div>
            <ul>
              {branches.local.map((b) => (
                <li key={b} className="flex items-center gap-2 px-1 py-1 hover:bg-[#2a2d2e] rounded">
                  <BranchIcon className="w-3 h-3 text-[#969696]" />
                  <button
                    onClick={() => act('checkout', async () => (await G.checkout(repo, b), `Switched to ${b}`))}
                    className={`flex-1 text-left text-[11px] ${b === branch ? 'text-[#3b8eea]' : ''}`}
                  >
                    {b}
                    {b === branch && ' (current)'}
                  </button>
                </li>
              ))}
              {branches.remote.map((b) => (
                <li key={b} className="flex items-center gap-2 px-1 py-1 text-[#969696]">
                  <BranchIcon className="w-3 h-3" />
                  <span className="text-[11px]">{b}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-[#3c3c3c] text-[11px] text-[#969696]">
              {remotes.length ? (
                remotes.map((r) => (
                  <div key={r.remote} className="truncate">
                    {r.remote} → {r.url}
                  </div>
                ))
              ) : (
                <span>no remotes</span>
              )}
            </div>
          </div>
        )}

        {repo && tab === 'history' && (
          <ul className="p-2 space-y-1">
            {commits.length === 0 && <p className="text-[11px] text-[#969696]">No commits yet</p>}
            {commits.map((c) => (
              <li key={c.oid} className="px-1 py-1.5 hover:bg-[#2a2d2e] rounded">
                <div className="flex items-center gap-2">
                  <CommitIcon className="w-3 h-3 text-[#969696]" />
                  <span className="font-mono text-[10px] text-[#e2c08d]">{c.oid.slice(0, 7)}</span>
                  <span className="text-[11px] truncate">{c.message.split('\n')[0]}</span>
                </div>
                <div className="pl-5 text-[10px] text-[#969696]">
                  {c.author} · {new Date(c.timestamp).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'auth' && (
          <div className="p-2 space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] text-[#969696]">Connect with OAuth (recommended)</p>
              <div className="flex gap-1">
                <button
                  onClick={() => startOAuth('github')}
                  className="flex-1 px-2 py-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[11px]"
                >
                  Connect GitHub
                </button>
                <button
                  onClick={() => startOAuth('gitlab')}
                  className="flex-1 px-2 py-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[11px]"
                >
                  Connect GitLab
                </button>
              </div>
              <p className="text-[10px] text-[#6a6a6a]">
                Tokens are stored in the encrypted server vault and injected by the Git relay — they never
                touch this browser.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-[#969696] flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Or use a personal access token
              </p>
              <input
                value={credHost}
                onChange={(e) => setCredHost(e.target.value)}
                placeholder="github.com / gitlab.com / bitbucket.org"
                className="w-full bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
              />
              <input
                value={credUser}
                onChange={(e) => setCredUser(e.target.value)}
                placeholder="username (oauth2 for GitLab)"
                className="w-full bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
              />
              <input
                type="password"
                value={credToken}
                onChange={(e) => setCredToken(e.target.value)}
                placeholder="token"
                className="w-full bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
              />
              <button
                onClick={async () => {
                  if (!credHost || !credToken) {
                    setStatus({ text: 'Host and token are required', error: true });
                    return;
                  }
                  try {
                    await G.setCredential(credHost, { username: credUser || 'oauth2', token: credToken });
                    setCreds(G.cachedCredentials());
                    setCredToken('');
                    setStatus({ text: `Saved credentials for ${credHost}` });
                  } catch (e) {
                    setStatus({ text: e instanceof Error ? e.message : 'Failed to save', error: true });
                  }
                }}
                className="w-full px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] rounded text-[11px]"
              >
                Save token securely
              </button>
              <ul className="text-[11px] text-[#969696]">
                {creds.map((cred) => (
                  <li key={cred.host} className="flex items-center justify-between py-0.5">
                    <span>
                      {cred.host} · {cred.provider_username || cred.username} ·{' '}
                      {cred.source === 'oauth' ? 'OAuth' : 'token'}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await G.removeCredential(cred.host);
                          setCreds(G.cachedCredentials());
                        } catch (e) {
                          setStatus({ text: e instanceof Error ? e.message : 'Failed', error: true });
                        }
                      }}
                      className="hover:text-[#f14c4c]"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1 pt-2 border-t border-[#3c3c3c]">
              <p className="text-[11px] text-[#969696]">Commit identity</p>
              <input
                value={author.name}
                onChange={(e) => setAuthorState({ ...author, name: e.target.value })}
                placeholder="Your name"
                className="w-full bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
              />
              <input
                value={author.email}
                onChange={(e) => setAuthorState({ ...author, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full bg-[#3c3c3c] px-2 py-1 rounded text-[11px] outline-none"
              />
              <button
                onClick={() => {
                  G.setAuthor(author);
                  setStatus({ text: 'Commit identity saved' });
                }}
                className="w-full px-2 py-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[11px]"
              >
                Save identity
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}