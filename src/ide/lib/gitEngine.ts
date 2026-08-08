/**
 * Real Git engine running in the browser.
 *
 * Uses isomorphic-git (a full Git implementation) on top of lightning-fs
 * (a persistent IndexedDB filesystem). Every operation below is real Git:
 * objects, refs, index, packfiles, and the smart HTTP protocol used to talk
 * to GitHub / GitLab / Bitbucket.
 */
import LightningFS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

export const fsInstance = new LightningFS('triage-ide');
export const fs = fsInstance as unknown as Parameters<typeof git.init>[0]['fs'];
export const pfs = fsInstance.promises;

export const WORKSPACE = '/workspace';

/** Browsers cannot talk to git hosts directly (no CORS headers), so we relay. */
const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org';

const LS_TOKENS = 'triage.git.tokens';
const LS_AUTHOR = 'triage.git.author';
const LS_PROXY = 'triage.git.corsProxy';

export interface GitCredential {
  username: string;
  token: string;
}

type TokenMap = Record<string, GitCredential>;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getCorsProxy(): string {
  return localStorage.getItem(LS_PROXY) || DEFAULT_CORS_PROXY;
}

export function setCorsProxy(url: string) {
  localStorage.setItem(LS_PROXY, url);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function listCredentials(): TokenMap {
  return readJSON<TokenMap>(LS_TOKENS, {});
}

export function setCredential(host: string, cred: GitCredential) {
  const all = listCredentials();
  all[host] = cred;
  localStorage.setItem(LS_TOKENS, JSON.stringify(all));
}

export function removeCredential(host: string) {
  const all = listCredentials();
  delete all[host];
  localStorage.setItem(LS_TOKENS, JSON.stringify(all));
}

function onAuth(url: string) {
  const cred = listCredentials()[hostOf(url)];
  if (!cred) return undefined;
  return { username: cred.username || 'oauth2', password: cred.token };
}

export interface GitAuthor {
  name: string;
  email: string;
}

export function getAuthor(): GitAuthor {
  return readJSON<GitAuthor>(LS_AUTHOR, { name: 'Triage User', email: 'dev@triage.local' });
}

export function setAuthor(author: GitAuthor) {
  localStorage.setItem(LS_AUTHOR, JSON.stringify(author));
}

/* ------------------------------------------------------------------ */
/* filesystem helpers                                                  */
/* ------------------------------------------------------------------ */

export async function ensureDir(path: string) {
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    try {
      await pfs.mkdir(current);
    } catch {
      /* already exists */
    }
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await pfs.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDir(path: string): Promise<boolean> {
  try {
    const st = await pfs.stat(path);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export async function readFile(path: string): Promise<string> {
  const data = (await pfs.readFile(path, { encoding: 'utf8' })) as unknown as string;
  return typeof data === 'string' ? data : new TextDecoder().decode(data as unknown as Uint8Array);
}

export async function writeFile(path: string, content: string) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) await ensureDir(dir);
  await pfs.writeFile(path, content, { encoding: 'utf8' });
}

export async function rmrf(path: string) {
  if (await isDir(path)) {
    const entries = (await pfs.readdir(path)) as string[];
    for (const entry of entries) await rmrf(`${path}/${entry}`);
    await pfs.rmdir(path);
  } else {
    await pfs.unlink(path);
  }
}

export async function initWorkspace() {
  await ensureDir(WORKSPACE);
}

/** Walk up from `dir` looking for a .git directory. */
export async function findRepoRoot(dir: string): Promise<string | null> {
  let current = dir;
  for (;;) {
    if (await exists(`${current}/.git`)) return current;
    if (current === '/' || current === '') return null;
    current = current.split('/').slice(0, -1).join('/') || '/';
  }
}

/* ------------------------------------------------------------------ */
/* git operations                                                      */
/* ------------------------------------------------------------------ */

export interface StatusEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked' | 'unmodified';
  staged: boolean;
}

export async function initRepo(dir: string, defaultBranch = 'main') {
  await ensureDir(dir);
  await git.init({ fs, dir, defaultBranch });
}

export async function cloneRepo(opts: {
  url: string;
  dir: string;
  ref?: string;
  depth?: number;
  onProgress?: (message: string) => void;
}) {
  await ensureDir(opts.dir);
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,
    corsProxy: getCorsProxy(),
    ref: opts.ref,
    singleBranch: !!opts.ref,
    depth: opts.depth ?? 25,
    onAuth: () => onAuth(opts.url) ?? {},
    onMessage: (m) => opts.onProgress?.(m.trim()),
    onProgress: (p) =>
      opts.onProgress?.(
        p.total ? `${p.phase} ${Math.round((p.loaded / p.total) * 100)}%` : p.phase,
      ),
  });
}

export async function statusMatrix(dir: string): Promise<StatusEntry[]> {
  const matrix = await git.statusMatrix({ fs, dir });
  const entries: StatusEntry[] = [];
  for (const [filepath, head, workdir, stage] of matrix) {
    if (head === 1 && workdir === 1 && stage === 1) continue; // unmodified
    let status: StatusEntry['status'] = 'modified';
    if (head === 0 && stage === 0) status = 'untracked';
    else if (head === 0 && stage > 0) status = 'added';
    else if (workdir === 0) status = 'deleted';
    entries.push({
      path: filepath,
      status,
      staged: stage !== 1 ? stage === workdir : head !== workdir,
    });
  }
  return entries;
}

export async function stage(dir: string, filepath: string) {
  if (await exists(`${dir}/${filepath}`)) {
    await git.add({ fs, dir, filepath });
  } else {
    await git.remove({ fs, dir, filepath });
  }
}

export async function stageAll(dir: string) {
  const entries = await statusMatrix(dir);
  for (const entry of entries) await stage(dir, entry.path);
  return entries.length;
}

export async function unstage(dir: string, filepath: string) {
  await git.resetIndex({ fs, dir, filepath });
}

export async function commit(dir: string, message: string) {
  const author = getAuthor();
  return git.commit({ fs, dir, message, author });
}

export interface LogEntry {
  oid: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

export async function log(dir: string, depth = 30): Promise<LogEntry[]> {
  const commits = await git.log({ fs, dir, depth });
  return commits.map((c) => ({
    oid: c.oid,
    message: c.commit.message.trim(),
    author: c.commit.author.name,
    email: c.commit.author.email,
    timestamp: c.commit.author.timestamp * 1000,
  }));
}

export async function currentBranch(dir: string) {
  return (await git.currentBranch({ fs, dir, fullname: false })) || 'HEAD';
}

export async function listBranches(dir: string) {
  const local = await git.listBranches({ fs, dir });
  let remote: string[] = [];
  try {
    remote = (await git.listBranches({ fs, dir, remote: 'origin' })).map((b) => `origin/${b}`);
  } catch {
    /* no remote */
  }
  return { local, remote };
}

export async function checkout(dir: string, ref: string, create = false) {
  await git.checkout({ fs, dir, ref, force: false, ...(create ? { noCheckout: false } : {}) });
}

export async function createBranch(dir: string, name: string, checkoutAfter = true) {
  await git.branch({ fs, dir, ref: name, checkout: checkoutAfter });
}

export async function deleteBranch(dir: string, name: string) {
  await git.deleteBranch({ fs, dir, ref: name });
}

export async function listRemotes(dir: string) {
  return git.listRemotes({ fs, dir });
}

export async function addRemote(dir: string, remote: string, url: string) {
  await git.addRemote({ fs, dir, remote, url, force: true });
}

async function remoteUrl(dir: string, remote = 'origin') {
  const remotes = await listRemotes(dir);
  return remotes.find((r) => r.remote === remote)?.url;
}

export async function push(dir: string, opts: { remote?: string; ref?: string; force?: boolean } = {}) {
  const remote = opts.remote ?? 'origin';
  const url = await remoteUrl(dir, remote);
  if (!url) throw new Error(`No remote "${remote}" configured`);
  if (!listCredentials()[hostOf(url)]) {
    throw new Error(`No credentials for ${hostOf(url)} — add a token in the Git panel first`);
  }
  return git.push({
    fs,
    http,
    dir,
    remote,
    ref: opts.ref,
    force: opts.force,
    corsProxy: getCorsProxy(),
    onAuth: () => onAuth(url) ?? {},
  });
}

export async function pull(dir: string, opts: { remote?: string; ref?: string } = {}) {
  const remote = opts.remote ?? 'origin';
  const url = await remoteUrl(dir, remote);
  const author = getAuthor();
  await git.pull({
    fs,
    http,
    dir,
    remote,
    ref: opts.ref,
    singleBranch: true,
    author,
    corsProxy: getCorsProxy(),
    onAuth: () => (url ? onAuth(url) ?? {} : {}),
  });
}

export async function fetch(dir: string, remote = 'origin') {
  const url = await remoteUrl(dir, remote);
  return git.fetch({
    fs,
    http,
    dir,
    remote,
    corsProxy: getCorsProxy(),
    onAuth: () => (url ? onAuth(url) ?? {} : {}),
  });
}

export async function diffFile(dir: string, filepath: string): Promise<{ head: string; workdir: string }> {
  let head = '';
  try {
    const oid = await git.resolveRef({ fs, dir, ref: 'HEAD' });
    const { blob } = await git.readBlob({ fs, dir, oid, filepath });
    head = new TextDecoder().decode(blob);
  } catch {
    head = '';
  }
  let workdir = '';
  try {
    workdir = await readFile(`${dir}/${filepath}`);
  } catch {
    workdir = '';
  }
  return { head, workdir };
}

/** All repositories currently cloned into the workspace. */
export async function listRepos(): Promise<string[]> {
  await initWorkspace();
  const entries = (await pfs.readdir(WORKSPACE)) as string[];
  const repos: string[] = [];
  for (const entry of entries) {
    const dir = `${WORKSPACE}/${entry}`;
    if (await exists(`${dir}/.git`)) repos.push(dir);
  }
  return repos;
}

export { git, http };