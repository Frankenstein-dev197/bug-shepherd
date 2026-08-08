/**
 * A real shell running against the browser filesystem (lightning-fs) with a
 * real git implementation (isomorphic-git). Commands mutate an actual
 * persistent filesystem — nothing here is simulated.
 *
 * Platform commands (bugs, projects, keys, ...) are forwarded to the
 * `dev-console` edge function so they execute server-side.
 */
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as G from './gitEngine';

export interface ShellResult {
  output: string;
  error?: boolean;
  cleared?: boolean;
}

const PLATFORM_COMMANDS = [
  'help',
  'whoami',
  'bugs',
  'projects',
  'team',
  'keys',
  'repos',
  'events',
  'stats',
  'sql',
];

const LOCAL_HELP = [
  'Triage Shell — real filesystem + real git engine',
  '',
  'Filesystem   pwd, ls [-la] [path], cd [path], cat <file>, mkdir <dir>, touch <file>,',
  '             rm [-rf] <path>, cp <src> <dst>, mv <src> <dst>,',
  '             echo <text> [> file | >> file], head/tail [-n N] <file>, wc <file>,',
  '             grep <pattern> <file>, find [path], tree [path], clear, date, env',
  'Git          git clone <url> [dir], git init, git status, git add <path|.>,',
  '             git reset <path>, git commit -m "msg", git log [-n N],',
  '             git branch [name] [-d name], git checkout [-b] <ref>,',
  '             git remote [add <name> <url>], git push [remote] [branch],',
  '             git pull, git fetch, git diff <file>,',
  '             git config user.name|user.email|cors.proxy <value>,',
  '             git auth <host> <username> <token> | git auth list | git auth rm <host>',
  'Platform     whoami, bugs, projects, team, keys, repos, events (executed server-side)',
  '',
  'Repositories live under /workspace and persist in your browser.',
].join('\n');

function splitArgs(input: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ' ') {
      if (current) out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) out.push(current);
  return out;
}

export class Shell {
  cwd = G.WORKSPACE;

  async init() {
    await G.initWorkspace();
  }

  resolve(input?: string): string {
    if (!input || input === '.') return this.cwd;
    let path = input.startsWith('/') ? input : `${this.cwd}/${input}`;
    const parts: string[] = [];
    for (const segment of path.split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') parts.pop();
      else parts.push(segment);
    }
    path = '/' + parts.join('/');
    return path === '/' ? '/' : path.replace(/\/$/, '');
  }

  private async repo(): Promise<string> {
    const root = await G.findRepoRoot(this.cwd);
    if (!root) throw new Error('fatal: not a git repository (or any of the parent directories)');
    return root;
  }

  get prompt(): string {
    return this.cwd.replace(G.WORKSPACE, '~') || '~';
  }

  async run(input: string, onProgress?: (line: string) => void): Promise<ShellResult> {
    const line = input.trim();
    if (!line) return { output: '' };

    const args = splitArgs(line);
    const cmd = args[0];

    try {
      if (cmd === 'git') return await this.git(args.slice(1), onProgress);
      if (PLATFORM_COMMANDS.includes(cmd)) return await this.platform(line);
      return await this.fsCommand(cmd, args.slice(1), line);
    } catch (err) {
      return { output: err instanceof Error ? err.message : String(err), error: true };
    }
  }

  /* --------------------------- filesystem ---------------------------- */

  private async fsCommand(cmd: string, args: string[], raw: string): Promise<ShellResult> {
    switch (cmd) {
      case 'clear':
        return { output: '', cleared: true };
      case 'date':
        return { output: new Date().toString() };
      case 'env':
        return {
          output: [
            `PWD=${this.cwd}`,
            `HOME=${G.WORKSPACE}`,
            `GIT_AUTHOR_NAME=${G.getAuthor().name}`,
            `GIT_AUTHOR_EMAIL=${G.getAuthor().email}`,
            `GIT_CORS_PROXY=${G.getCorsProxy()}`,
          ].join('\n'),
        };
      case 'pwd':
        return { output: this.cwd };

      case 'cd': {
        const target = this.resolve(args[0] ?? G.WORKSPACE);
        if (!(await G.isDir(target))) return { output: `cd: ${args[0]}: No such directory`, error: true };
        this.cwd = target;
        return { output: '' };
      }

      case 'ls': {
        const flags = args.filter((a) => a.startsWith('-')).join('');
        const rest = args.filter((a) => !a.startsWith('-'));
        const target = this.resolve(rest[0]);
        if (!(await G.exists(target)))
          return { output: `ls: ${rest[0] ?? target}: No such file or directory`, error: true };
        if (!(await G.isDir(target))) return { output: target.split('/').pop() ?? '' };
        let entries = ((await G.pfs.readdir(target)) as string[]).sort();
        if (!flags.includes('a')) entries = entries.filter((e) => !e.startsWith('.'));
        if (!flags.includes('l')) return { output: entries.join('  ') };
        const rows: string[] = [];
        for (const entry of entries) {
          const st = await G.pfs.stat(`${target}/${entry}`);
          const dir = st.isDirectory();
          rows.push(`${dir ? 'd' : '-'}rw-r--r--  ${String(st.size).padStart(8)}  ${entry}${dir ? '/' : ''}`);
        }
        return { output: rows.join('\n') };
      }

      case 'cat': {
        if (!args[0]) return { output: 'cat: missing operand', error: true };
        const path = this.resolve(args[0]);
        if (!(await G.exists(path))) return { output: `cat: ${args[0]}: No such file`, error: true };
        return { output: await G.readFile(path) };
      }

      case 'mkdir': {
        const rest = args.filter((a) => !a.startsWith('-'));
        if (!rest[0]) return { output: 'mkdir: missing operand', error: true };
        await G.ensureDir(this.resolve(rest[0]));
        return { output: '' };
      }

      case 'touch': {
        if (!args[0]) return { output: 'touch: missing operand', error: true };
        const path = this.resolve(args[0]);
        if (!(await G.exists(path))) await G.writeFile(path, '');
        return { output: '' };
      }

      case 'rm': {
        const rest = args.filter((a) => !a.startsWith('-'));
        const recursive = args.some((a) => a.startsWith('-') && a.includes('r'));
        if (!rest[0]) return { output: 'rm: missing operand', error: true };
        const path = this.resolve(rest[0]);
        if (!(await G.exists(path))) return { output: `rm: ${rest[0]}: No such file or directory`, error: true };
        if ((await G.isDir(path)) && !recursive) return { output: `rm: ${rest[0]}: is a directory`, error: true };
        await G.rmrf(path);
        return { output: '' };
      }

      case 'cp': {
        if (args.length < 2) return { output: 'cp: missing operand', error: true };
        await G.writeFile(this.resolve(args[1]), await G.readFile(this.resolve(args[0])));
        return { output: '' };
      }

      case 'mv': {
        if (args.length < 2) return { output: 'mv: missing operand', error: true };
        const from = this.resolve(args[0]);
        await G.writeFile(this.resolve(args[1]), await G.readFile(from));
        await G.rmrf(from);
        return { output: '' };
      }

      case 'echo': {
        const appendMatch = raw.match(/^echo\s+([\s\S]*?)\s*>>\s*(\S+)$/);
        const writeMatch = raw.match(/^echo\s+([\s\S]*?)\s*>\s*(\S+)$/);
        const unquote = (v: string) => v.replace(/^["']|["']$/g, '');
        if (appendMatch) {
          const path = this.resolve(appendMatch[2]);
          const prev = (await G.exists(path)) ? await G.readFile(path) : '';
          await G.writeFile(path, `${prev}${unquote(appendMatch[1])}\n`);
          return { output: '' };
        }
        if (writeMatch) {
          await G.writeFile(this.resolve(writeMatch[2]), `${unquote(writeMatch[1])}\n`);
          return { output: '' };
        }
        return { output: args.join(' ') };
      }

      case 'head':
      case 'tail': {
        const nIndex = args.indexOf('-n');
        const count = nIndex >= 0 ? parseInt(args[nIndex + 1], 10) || 10 : 10;
        const files = args.filter((a, i) => !a.startsWith('-') && i !== nIndex + 1);
        if (!files[0]) return { output: `${cmd}: missing operand`, error: true };
        const lines = (await G.readFile(this.resolve(files[0]))).split('\n');
        return { output: (cmd === 'head' ? lines.slice(0, count) : lines.slice(-count)).join('\n') };
      }

      case 'wc': {
        if (!args[0]) return { output: 'wc: missing operand', error: true };
        const text = await G.readFile(this.resolve(args[0]));
        const words = text.split(/\s+/).filter(Boolean).length;
        return { output: `${text.split('\n').length} ${words} ${text.length} ${args[0]}` };
      }

      case 'grep': {
        if (args.length < 2) return { output: 'usage: grep <pattern> <file>', error: true };
        const [pattern, ...files] = args;
        const results: string[] = [];
        for (const file of files) {
          const text = await G.readFile(this.resolve(file));
          text.split('\n').forEach((l, i) => {
            if (l.includes(pattern)) results.push(`${file}:${i + 1}: ${l}`);
          });
        }
        return { output: results.join('\n') || `no matches for "${pattern}"` };
      }

      case 'find': {
        const root = this.resolve(args[0]);
        const found: string[] = [];
        const walk = async (dir: string) => {
          const entries = (await G.pfs.readdir(dir)) as string[];
          for (const entry of entries) {
            if (entry === '.git') continue;
            const path = `${dir}/${entry}`;
            found.push(path);
            if (await G.isDir(path)) await walk(path);
          }
        };
        if (await G.isDir(root)) await walk(root);
        return { output: found.join('\n') };
      }

      case 'tree': {
        const root = this.resolve(args[0]);
        const out: string[] = [root];
        const walk = async (dir: string, prefix: string) => {
          const entries = ((await G.pfs.readdir(dir)) as string[]).filter((e) => e !== '.git').sort();
          for (let i = 0; i < entries.length; i++) {
            const last = i === entries.length - 1;
            const path = `${dir}/${entries[i]}`;
            out.push(`${prefix}${last ? '└── ' : '├── '}${entries[i]}`);
            if (await G.isDir(path)) await walk(path, `${prefix}${last ? '    ' : '│   '}`);
          }
        };
        if (await G.isDir(root)) await walk(root, '');
        return { output: out.join('\n') };
      }

      default:
        return { output: `${cmd}: command not found (try "help")`, error: true };
    }
  }

  /* ------------------------------- git -------------------------------- */

  private async git(args: string[], onProgress?: (line: string) => void): Promise<ShellResult> {
    const sub = args[0];
    switch (sub) {
      case undefined:
      case '--help':
        return { output: LOCAL_HELP };

      case 'init': {
        const dir = this.resolve(args[1]);
        await G.initRepo(dir);
        return { output: `Initialized empty Git repository in ${dir}/.git` };
      }

      case 'clone': {
        const url = args[1];
        if (!url) return { output: 'usage: git clone <url> [dir]', error: true };
        const name = args[2] ?? url.replace(/\.git$/, '').split('/').pop() ?? 'repo';
        const dir = this.resolve(name);
        onProgress?.(`Cloning into '${dir}'...`);
        await G.cloneRepo({ url, dir, onProgress });
        return { output: `Cloned ${url} into ${dir} (branch ${await G.currentBranch(dir)})` };
      }

      case 'status': {
        const dir = await this.repo();
        const branch = await G.currentBranch(dir);
        const entries = await G.statusMatrix(dir);
        if (!entries.length) return { output: `On branch ${branch}\nnothing to commit, working tree clean` };
        const lines = [`On branch ${branch}`, ''];
        for (const e of entries) lines.push(`  ${e.staged ? 'S' : ' '} ${e.status.padEnd(9)} ${e.path}`);
        return { output: lines.join('\n') };
      }

      case 'add': {
        const dir = await this.repo();
        const target = args[1] ?? '.';
        if (target === '.' || target === '-A') {
          return { output: `staged ${await G.stageAll(dir)} file(s)` };
        }
        await G.stage(dir, target.replace(`${dir}/`, ''));
        return { output: `staged ${target}` };
      }

      case 'reset': {
        const dir = await this.repo();
        if (!args[1]) return { output: 'usage: git reset <path>', error: true };
        await G.unstage(dir, args[1]);
        return { output: `unstaged ${args[1]}` };
      }

      case 'commit': {
        const dir = await this.repo();
        const mIndex = args.findIndex((a) => a === '-m' || a === '--message');
        const message = mIndex >= 0 ? args[mIndex + 1] : undefined;
        if (!message) return { output: 'usage: git commit -m "message"', error: true };
        const oid = await G.commit(dir, message);
        return { output: `[${await G.currentBranch(dir)} ${oid.slice(0, 7)}] ${message}` };
      }

      case 'log': {
        const dir = await this.repo();
        const nIndex = args.indexOf('-n');
        const depth = nIndex >= 0 ? parseInt(args[nIndex + 1], 10) || 10 : 10;
        const commits = await G.log(dir, depth);
        return {
          output: commits
            .map((c) => {
              const when = new Date(c.timestamp).toISOString().slice(0, 16).replace('T', ' ');
              return `${c.oid.slice(0, 7)}  ${when}  ${c.author.padEnd(14)}  ${c.message.split('\n')[0]}`;
            })
            .join('\n'),
        };
      }

      case 'branch': {
        const dir = await this.repo();
        if (args[1] === '-d' || args[1] === '-D') {
          await G.deleteBranch(dir, args[2]);
          return { output: `Deleted branch ${args[2]}` };
        }
        if (args[1]) {
          await G.createBranch(dir, args[1], false);
          return { output: `Created branch ${args[1]}` };
        }
        const { local, remote } = await G.listBranches(dir);
        const current = await G.currentBranch(dir);
        return {
          output: [
            ...local.map((b) => `${b === current ? '*' : ' '} ${b}`),
            ...remote.map((b) => `  ${b}`),
          ].join('\n'),
        };
      }

      case 'checkout': {
        const dir = await this.repo();
        if (args[1] === '-b') {
          await G.createBranch(dir, args[2], true);
          return { output: `Switched to a new branch '${args[2]}'` };
        }
        if (!args[1]) return { output: 'usage: git checkout [-b] <ref>', error: true };
        await G.checkout(dir, args[1]);
        return { output: `Switched to '${args[1]}'` };
      }

      case 'remote': {
        const dir = await this.repo();
        if (args[1] === 'add') {
          if (!args[2] || !args[3]) return { output: 'usage: git remote add <name> <url>', error: true };
          await G.addRemote(dir, args[2], args[3]);
          return { output: `added remote ${args[2]}` };
        }
        const remotes = await G.listRemotes(dir);
        return { output: remotes.map((r) => `${r.remote}\t${r.url}`).join('\n') || 'no remotes' };
      }

      case 'push': {
        const dir = await this.repo();
        onProgress?.('Pushing...');
        const result = await G.push(dir, { remote: args[1], ref: args[2] });
        const err = result.error ?? result.ok?.length === 0 ? result.error : undefined;
        if (err) return { output: `push rejected: ${err}`, error: true };
        return { output: `pushed to ${args[1] ?? 'origin'}` };
      }

      case 'pull': {
        const dir = await this.repo();
        onProgress?.('Pulling...');
        await G.pull(dir, { remote: args[1], ref: args[2] });
        return { output: 'pull complete' };
      }

      case 'fetch': {
        const dir = await this.repo();
        const res = await G.fetch(dir, args[1]);
        return { output: `fetched ${res.defaultBranch ?? ''} (${res.fetchHead?.slice(0, 7) ?? 'up to date'})` };
      }

      case 'diff': {
        const dir = await this.repo();
        if (!args[1]) return { output: 'usage: git diff <file>', error: true };
        const filepath = args[1].replace(`${dir}/`, '');
        const { head, workdir } = await G.diffFile(dir, filepath);
        const headLines = head.split('\n');
        const workLines = workdir.split('\n');
        const out: string[] = [`--- a/${filepath}`, `+++ b/${filepath}`];
        const max = Math.max(headLines.length, workLines.length);
        for (let i = 0; i < max; i++) {
          if (headLines[i] === workLines[i]) continue;
          if (headLines[i] !== undefined) out.push(`-${headLines[i]}`);
          if (workLines[i] !== undefined) out.push(`+${workLines[i]}`);
        }
        return { output: out.length > 2 ? out.join('\n') : 'no changes' };
      }

      case 'config': {
        const key = args[1];
        const value = args.slice(2).join(' ');
        const author = G.getAuthor();
        if (key === 'user.name' && value) {
          G.setAuthor({ ...author, name: value });
          return { output: `user.name = ${value}` };
        }
        if (key === 'user.email' && value) {
          G.setAuthor({ ...author, email: value });
          return { output: `user.email = ${value}` };
        }
        if (key === 'cors.proxy' && value) {
          G.setCorsProxy(value);
          return { output: `cors.proxy = ${value}` };
        }
        return {
          output: `user.name=${author.name}\nuser.email=${author.email}\ncors.proxy=${G.getCorsProxy()}`,
        };
      }

      case 'auth': {
        if (!args[1] || args[1] === 'list') {
          const creds = G.listCredentials();
          const hosts = Object.keys(creds);
          return {
            output: hosts.length
              ? hosts.map((h) => `${h}\t${creds[h].username}\t${'•'.repeat(8)}`).join('\n')
              : 'no credentials stored',
          };
        }
        if (args[1] === 'rm') {
          G.removeCredential(args[2]);
          return { output: `removed credentials for ${args[2]}` };
        }
        const [, host, username, token] = args;
        if (!host || !token) return { output: 'usage: git auth <host> <username> <token>', error: true };
        G.setCredential(host, { username, token });
        return { output: `stored credentials for ${host}` };
      }

      default:
        return { output: `git: '${sub}' is not a supported command`, error: true };
    }
  }

  /* ----------------------------- platform ----------------------------- */

  private async platform(line: string): Promise<ShellResult> {
    if (line.trim() === 'help') {
      const { data } = await supabase.functions.invoke('dev-console', { body: { command: 'help' } });
      const remote = data?.output ? `\n\nServer commands:\n${data.output}` : '';
      return { output: `${LOCAL_HELP}${remote}` };
    }
    const { data, error } = await supabase.functions.invoke('dev-console', { body: { command: line } });
    if (error) {
      const detail = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      return { output: detail, error: true };
    }
    return { output: String(data?.output ?? ''), error: data?.success === false };
  }
}