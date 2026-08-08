// IDE Core Types

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
  isDirty?: boolean;
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
}

export interface EditorTab {
  id: string;
  fileId: string;
  filePath: string;
  fileName: string;
  content: string;
  language: string;
  isDirty: boolean;
  isActive: boolean;
  savedContent?: string;
}

export interface SearchResult {
  fileId: string;
  filePath: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  history: TerminalLine[];
  currentDirectory: string;
  isActive: boolean;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommit?: string;
  lastCommitDate?: Date;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files?: string[];
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  additions?: number;
  deletions?: number;
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIConversation {
  id: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  files?: string[];
}

export interface Breakpoint {
  id: string;
  filePath: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
  children?: DebugVariable[];
}

export interface DebugStackFrame {
  id: string;
  name: string;
  filePath: string;
  line: number;
  column: number;
  variables?: DebugVariable[];
}

export interface DebugSession {
  id: string;
  status: 'stopped' | 'running' | 'paused' | 'terminated';
  breakpoints: Breakpoint[];
  currentFrame?: DebugStackFrame;
  callStack: DebugStackFrame[];
  watches: string[];
}

export interface IDETheme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    error: string;
    warning: string;
    info: string;
    success: string;
  };
  isDark: boolean;
}

export type Language = 
  | 'typescript' | 'javascript' | 'python' | 'java' 
  | 'csharp' | 'cpp' | 'c' | 'go' | 'rust' | 'ruby'
  | 'php' | 'swift' | 'kotlin' | 'scala' | 'sql'
  | 'html' | 'css' | 'scss' | 'less' | 'json' | 'yaml'
  | 'xml' | 'markdown' | 'dockerfile' | 'shell' | 'plaintext';

export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'py': 'python',
  'java': 'java',
  'cs': 'csharp',
  'cpp': 'cpp',
  'c': 'c',
  'go': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'sql': 'sql',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'md': 'markdown',
  'Dockerfile': 'dockerfile',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
};

export const LANGUAGE_MONACO: Record<string, string> = {
  'typescript': 'typescript',
  'javascript': 'javascript',
  'python': 'python',
  'java': 'java',
  'csharp': 'csharp',
  'cpp': 'cpp',
  'c': 'c',
  'go': 'go',
  'rust': 'rust',
  'ruby': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'scala': 'scala',
  'sql': 'sql',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  'json': 'json',
  'yaml': 'yaml',
  'xml': 'xml',
  'markdown': 'markdown',
  'dockerfile': 'dockerfile',
  'shell': 'shell',
  'plaintext': 'plaintext',
};
