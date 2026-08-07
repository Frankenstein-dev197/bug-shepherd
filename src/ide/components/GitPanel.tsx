import { useState, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  GitMerge,
  Plus,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Clock,
  User,
  FileText,
  GitFork,
  Star,
  Eye,
  Link2,
  ExternalLink,
  ArrowRight,
  Diff,
} from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  modified: GitFile[];
  untracked: GitFile[];
  conflicts: GitFile[];
}

interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicting';
  oldPath?: string;
}

interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  branches?: string[];
  tags?: string[];
}

interface GitBranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

// Sample data
const sampleStatus: GitStatus = {
  branch: 'feature/modern-ide-platform',
  ahead: 1,
  behind: 0,
  staged: [
    { path: 'src/ide/components/CommandPalette.tsx', status: 'added' },
    { path: 'src/ide/components/GitPanel.tsx', status: 'modified' },
  ],
  modified: [
    { path: 'src/App.tsx', status: 'modified' },
    { path: 'README.md', status: 'modified' },
  ],
  untracked: [
    { path: 'src/new-feature.ts', status: 'untracked' },
  ],
  conflicts: [],
};

const sampleCommits: GitCommitInfo[] = [
  {
    hash: 'abc1234567890abcdef',
    shortHash: 'abc1234',
    message: 'feat: add modern IDE platform with Monaco Editor, AI Assistant, and Git integration',
    author: 'Developer',
    authorEmail: 'dev@example.com',
    date: new Date(Date.now() - 3600000),
    branches: ['feature/modern-ide-platform'],
  },
  {
    hash: 'def4567890abcdef1234',
    shortHash: 'def4567',
    message: 'fix: resolve migration syntax errors',
    author: 'Developer',
    authorEmail: 'dev@example.com',
    date: new Date(Date.now() - 7200000),
    branches: [],
    tags: ['v1.0.0'],
  },
  {
    hash: 'ghi7890abcdef123456',
    shortHash: 'ghi7890',
    message: 'docs: update README with new features',
    author: 'Developer',
    authorEmail: 'dev@example.com',
    date: new Date(Date.now() - 86400000),
  },
];

const sampleBranches: GitBranchInfo[] = [
  { name: 'feature/modern-ide-platform', isRemote: false, isCurrent: true },
  { name: 'feature/ai-integration', isRemote: false, isCurrent: false },
  { name: 'main', isRemote: true, isCurrent: false, upstream: 'origin/main' },
  { name: 'develop', isRemote: true, isCurrent: false, upstream: 'origin/develop' },
];

export function GitPanel() {
  const { setCurrentBranch, currentBranch } = useIDEStore();
  const [activeTab, setActiveTab] = useState<'changes' | 'commits' | 'branches' | 'remote'>('changes');
  const [status] = useState<GitStatus>(sampleStatus);
  const [commits] = useState<GitCommitInfo[]>(sampleCommits);
  const [branches] = useState<GitBranchInfo[]>(sampleBranches);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    // Simulate commit
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCommitMessage('');
    setIsCommitting(false);
  }, [commitMessage]);

  const getStatusIcon = (status: GitFile['status']) => {
    switch (status) {
      case 'added':
        return <Plus className="w-3 h-3 text-[#4ec9b0]" />;
      case 'modified':
        return <FileText className="w-3 h-3 text-[#dcdcaa]" />;
      case 'deleted':
        return <Trash2 className="w-3 h-3 text-[#f14c4c]" />;
      case 'renamed':
        return <Diff className="w-3 h-3 text-[#9cdcfe]" />;
      case 'untracked':
        return <GitFork className="w-3 h-3 text-[#6e6e6e]" />;
      case 'conflicting':
        return <AlertCircle className="w-3 h-3 text-[#f14c4c]" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#f1502f]" />
          <span className="text-[13px] font-medium text-[#cccccc]">Source Control</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
            title="More Actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Branch Info */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <GitBranch className="w-3 h-3 text-[#858585]" />
        <span className="text-[12px] text-[#cccccc]">{status.branch}</span>
        {status.ahead > 0 && (
          <span className="text-[10px] text-[#4ec9b0]">
            ↑{status.ahead}
          </span>
        )}
        {status.behind > 0 && (
          <span className="text-[10px] text-[#f14c4c]">
            ↓{status.behind}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#3c3c3c]">
        {[
          { id: 'changes', label: 'Changes' },
          { id: 'commits', label: 'Commit History' },
          { id: 'branches', label: 'Branches' },
          { id: 'remote', label: 'Remote' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-[12px] ${
              activeTab === tab.id
                ? 'text-[#cccccc] border-b-2 border-[#007acc]'
                : 'text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'changes' && (
          <div>
            {/* Commit Message */}
            <div className="p-3 border-b border-[#3c3c3c]">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full h-20 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[12px] rounded border border-[#4c4c4c] outline-none focus:border-[#007acc] resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#6e6e6e]">
                  {status.staged.length + status.modified.length + status.untracked.length} files changed
                </span>
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || isCommitting}
                  className="px-3 py-1.5 text-[12px] bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isCommitting ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Commit
                </button>
              </div>
            </div>

            {/* Staged Changes */}
            {status.staged.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[#858585] uppercase bg-[#1e1e1e]">
                  Staged Changes ({status.staged.length})
                </div>
                {status.staged.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer"
                  >
                    {getStatusIcon(file.status)}
                    <span className="flex-1 text-[12px] text-[#cccccc] truncate">{file.path}</span>
                    <button
                      className="p-1 hover:bg-[#3c3c3c] rounded text-[#6e6e6e] hover:text-[#cccccc]"
                      title="Unstage"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Modified Changes */}
            {status.modified.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[#858585] uppercase bg-[#1e1e1e]">
                  Changes ({status.modified.length})
                </div>
                {status.modified.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer"
                  >
                    {getStatusIcon(file.status)}
                    <span className="flex-1 text-[12px] text-[#cccccc] truncate">{file.path}</span>
                    <button
                      className="p-1 hover:bg-[#3c3c3c] rounded text-[#6e6e6e] hover:text-[#cccccc]"
                      title="Stage"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Untracked Files */}
            {status.untracked.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[#858585] uppercase bg-[#1e1e1e]">
                  Untracked ({status.untracked.length})
                </div>
                {status.untracked.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer"
                  >
                    {getStatusIcon(file.status)}
                    <span className="flex-1 text-[12px] text-[#cccccc] truncate">{file.path}</span>
                    <button
                      className="p-1 hover:bg-[#3c3c3c] rounded text-[#6e6e6e] hover:text-[#cccccc]"
                      title="Stage"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'commits' && (
          <div>
            {commits.map((commit) => (
              <div
                key={commit.hash}
                className="p-3 border-b border-[#3c3c3c] hover:bg-[#2a2d2e] cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <GitCommit className="w-3 h-3 text-[#858585]" />
                  <code className="text-[11px] text-[#4ec9b0]">{commit.shortHash}</code>
                  {commit.branches?.map((branch) => (
                    <span
                      key={branch}
                      className="px-1.5 py-0.5 text-[10px] bg-[#0e639c] text-white rounded"
                    >
                      {branch}
                    </span>
                  ))}
                  {commit.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-[10px] bg-[#4ec9b0] text-[#1e1e1e] rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-[12px] text-[#cccccc] mb-1 line-clamp-2">{commit.message}</p>
                <div className="flex items-center gap-3 text-[10px] text-[#6e6e6e]">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {commit.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(commit.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'branches' && (
          <div>
            <div className="p-3 border-b border-[#3c3c3c]">
              <button className="w-full px-3 py-2 text-[12px] bg-[#0e639c] text-white rounded hover:bg-[#1177bb] flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                New Branch
              </button>
            </div>
            {branches.map((branch) => (
              <div
                key={branch.name}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer ${
                  branch.isCurrent ? 'bg-[#094771]' : ''
                }`}
                onClick={() => setCurrentBranch(branch.name)}
              >
                {branch.isRemote ? (
                  <GitFork className="w-3 h-3 text-[#6e6e6e]" />
                ) : (
                  <GitBranch className="w-3 h-3 text-[#f1502f]" />
                )}
                <span className={`flex-1 text-[12px] ${branch.isCurrent ? 'text-white' : 'text-[#cccccc]'}`}>
                  {branch.name}
                </span>
                {branch.upstream && (
                  <span className="text-[10px] text-[#6e6e6e]">
                    {branch.upstream}
                  </span>
                )}
                {branch.isCurrent && (
                  <Check className="w-4 h-4 text-[#4ec9b0]" />
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'remote' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#858585]" />
                <span className="text-[13px] text-[#cccccc]">origin</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
                  title="Fetch"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
                  title="Push"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-[#1e1e1e] rounded">
                <GitBranch className="w-3 h-3 text-[#6e6e6e]" />
                <span className="text-[12px] text-[#cccccc]">main</span>
                <ArrowRight className="w-3 h-3 text-[#6e6e6e]" />
                <span className="text-[12px] text-[#cccccc]">origin/main</span>
                <span className="text-[10px] text-[#4ec9b0]">↑1</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#1e1e1e] rounded">
                <GitBranch className="w-3 h-3 text-[#6e6e6e]" />
                <span className="text-[12px] text-[#cccccc]">develop</span>
                <ArrowRight className="w-3 h-3 text-[#6e6e6e]" />
                <span className="text-[12px] text-[#cccccc]">origin/develop</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
