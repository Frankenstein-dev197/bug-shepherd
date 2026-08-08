import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  FileNode, 
  EditorTab, 
  TerminalSession, 
  TerminalLine,
  GitBranch,
  GitCommit,
  AIProvider,
  AIConversation,
  AIMessage,
  SearchResult,
  DebugSession,
  Breakpoint
} from '../types';
import { LANGUAGE_EXTENSIONS, LANGUAGE_MONACO } from '../types';

interface IDEState {
  // Files
  files: FileNode[];
  setFiles: (files: FileNode[]) => void;
  updateFileContent: (fileId: string, content: string) => void;
  addFile: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  deleteFile: (path: string) => void;
  renameFile: (path: string, newName: string) => void;
  
  // Editor Tabs
  tabs: EditorTab[];
  activeTabId: string | null;
  addTab: (file: { id: string; path: string; name: string; content: string }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  saveTab: (tabId: string) => void;
  
  // Search
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  
  // Terminal
  terminalSessions: TerminalSession[];
  activeTerminalId: string | null;
  addTerminalSession: () => void;
  closeTerminalSession: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  addTerminalLine: (sessionId: string, line: Omit<TerminalLine, 'id' | 'timestamp'>) => void;
  clearTerminal: (sessionId: string) => void;
  
  // Git
  branches: GitBranch[];
  setBranches: (branches: GitBranch[]) => void;
  currentBranch: string;
  setCurrentBranch: (branch: string) => void;
  commits: GitCommit[];
  setCommits: (commits: GitCommit[]) => void;
  stagedFiles: string[];
  setStagedFiles: (files: string[]) => void;
  unstagedFiles: string[];
  setUnstagedFiles: (files: string[]) => void;
  
  // AI
  aiProviders: AIProvider[];
  addAIProvider: (provider: AIProvider) => void;
  removeAIProvider: (id: string) => void;
  setActiveAIProvider: (id: string) => void;
  activeAIProviderId: string | null;
  conversations: AIConversation[];
  addConversation: () => AIConversation;
  deleteConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  activeConversationId: string | null;
  setActiveConversation: (id: string) => void;
  
  // Debug
  debugSession: DebugSession | null;
  startDebugSession: () => void;
  stopDebugSession: () => void;
  addBreakpoint: (breakpoint: Omit<Breakpoint, 'id'>) => void;
  removeBreakpoint: (id: string) => void;
  toggleBreakpoint: (id: string) => void;
  addWatch: (expression: string) => void;
  removeWatch: (expression: string) => void;
  
  // UI
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  terminalHeight: number;
  setTerminalHeight: (height: number) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const lang = LANGUAGE_EXTENSIONS[ext] || 'plaintext';
  return LANGUAGE_MONACO[lang] || 'plaintext';
};

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      // Files
      files: [],
      setFiles: (files) => set({ files }),
      updateFileContent: (fileId, content) => set((state) => ({
        files: updateFileInTree(state.files, fileId, { content }),
        tabs: state.tabs.map((tab) =>
          tab.id === fileId ? { ...tab, content, isDirty: tab.savedContent !== content } : tab
        ),
      })),
      addFile: (parentPath, name, type) => set((state) => ({
        files: addFileToTree(state.files, parentPath, {
          id: generateId(),
          name,
          path: `${parentPath}/${name}`,
          type,
          children: type === 'folder' ? [] : undefined,
          content: type === 'file' ? '' : undefined,
        }),
      })),
      deleteFile: (path) => set((state) => ({
        files: deleteFileFromTree(state.files, path),
        tabs: state.tabs.filter((tab) => !tab.filePath.startsWith(path)),
      })),
      renameFile: (path, newName) => set((state) => ({
        files: renameFileInTree(state.files, path, newName),
        tabs: state.tabs.map((tab) =>
          tab.filePath === path
            ? { ...tab, filePath: path.replace(/[^/]+$/, newName), fileName: newName }
            : tab
        ),
      })),
      
      // Editor Tabs
      tabs: [],
      activeTabId: null,
      addTab: (file) => set((state) => {
        const existingTab = state.tabs.find((t) => t.fileId === file.id);
        if (existingTab) {
          return { 
            tabs: state.tabs.map((t) => 
              t.id === existingTab.id ? { ...t, isActive: true } : { ...t, isActive: false }
            ),
            activeTabId: existingTab.id 
          };
        }
        const newTab: EditorTab = {
          id: generateId(),
          fileId: file.id,
          filePath: file.path,
          fileName: file.name,
          content: file.content,
          language: getLanguageFromPath(file.path),
          isDirty: false,
          isActive: true,
          savedContent: file.content,
        };
        return {
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        };
      }),
      closeTab: (tabId) => set((state) => {
        const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
        const newTabs = state.tabs.filter((t) => t.id !== tabId);
        let newActiveId = state.activeTabId;
        if (state.activeTabId === tabId) {
          if (newTabs.length > 0) {
            const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
            newActiveId = newTabs[newActiveIndex].id;
          } else {
            newActiveId = null;
          }
        }
        return {
          tabs: newTabs.map((t, i) => ({
            ...t,
            isActive: t.id === newActiveId,
          })),
          activeTabId: newActiveId,
        };
      }),
      setActiveTab: (tabId) => set((state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
        activeTabId: tabId,
      })),
      updateTabContent: (tabId, content) => set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, content, isDirty: t.savedContent !== content }
            : t
        ),
      })),
      saveTab: (tabId) => set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return state;
        return {
          tabs: state.tabs.map((t) =>
            t.id === tabId
              ? { ...t, savedContent: t.content, isDirty: false }
              : t
          ),
          files: updateFileInTree(state.files, tab.fileId, { content: tab.content }),
        };
      }),
      
      // Search
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      isSearching: false,
      setIsSearching: (searching) => set({ isSearching: searching }),
      
      // Terminal
      terminalSessions: [],
      activeTerminalId: null,
      addTerminalSession: () => set((state) => {
        const newSession: TerminalSession = {
          id: generateId(),
          name: `Terminal ${state.terminalSessions.length + 1}`,
          history: [],
          currentDirectory: '/workspace/project',
          isActive: true,
        };
        return {
          terminalSessions: [...state.terminalSessions.map((s) => ({ ...s, isActive: false })), newSession],
          activeTerminalId: newSession.id,
        };
      }),
      closeTerminalSession: (id) => set((state) => {
        const newSessions = state.terminalSessions.filter((s) => s.id !== id);
        let newActiveId = state.activeTerminalId;
        if (state.activeTerminalId === id) {
          newActiveId = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
        }
        return {
          terminalSessions: newSessions,
          activeTerminalId: newActiveId,
        };
      }),
      setActiveTerminal: (id) => set((state) => ({
        terminalSessions: state.terminalSessions.map((s) => ({ ...s, isActive: s.id === id })),
        activeTerminalId: id,
      })),
      addTerminalLine: (sessionId, line) => set((state) => ({
        terminalSessions: state.terminalSessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                history: [...s.history, { ...line, id: generateId(), timestamp: new Date() }],
              }
            : s
        ),
      })),
      clearTerminal: (sessionId) => set((state) => ({
        terminalSessions: state.terminalSessions.map((s) =>
          s.id === sessionId ? { ...s, history: [] } : s
        ),
      })),
      
      // Git
      branches: [],
      setBranches: (branches) => set({ branches }),
      currentBranch: 'main',
      setCurrentBranch: (branch) => set({ currentBranch: branch }),
      commits: [],
      setCommits: (commits) => set({ commits }),
      stagedFiles: [],
      setStagedFiles: (files) => set({ stagedFiles: files }),
      unstagedFiles: [],
      setUnstagedFiles: (files) => set({ unstagedFiles: files }),
      
      // AI
      aiProviders: [],
      addAIProvider: (provider) => set((state) => ({ aiProviders: [...state.aiProviders, provider] })),
      removeAIProvider: (id) => set((state) => ({
        aiProviders: state.aiProviders.filter((p) => p.id !== id),
        activeAIProviderId: state.activeAIProviderId === id ? null : state.activeAIProviderId,
      })),
      setActiveAIProvider: (id) => set({ activeAIProviderId: id }),
      activeAIProviderId: null,
      conversations: [],
      addConversation: () => {
        const newConversation: AIConversation = {
          id: generateId(),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ conversations: [...state.conversations, newConversation] }));
        return newConversation;
      },
      deleteConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
      })),
      addMessage: (conversationId, message) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, { ...message, id: generateId(), timestamp: new Date() }],
                updatedAt: new Date(),
              }
            : c
        ),
      })),
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),
      
      // Debug
      debugSession: null,
      startDebugSession: () => set({
        debugSession: {
          id: generateId(),
          status: 'stopped',
          breakpoints: [],
          callStack: [],
          watches: [],
        },
      }),
      stopDebugSession: () => set({ debugSession: null }),
      addBreakpoint: (breakpoint) => set((state) => {
        if (!state.debugSession) return state;
        return {
          debugSession: {
            ...state.debugSession,
            breakpoints: [...state.debugSession.breakpoints, { ...breakpoint, id: generateId() }],
          },
        };
      }),
      removeBreakpoint: (id) => set((state) => {
        if (!state.debugSession) return state;
        return {
          debugSession: {
            ...state.debugSession,
            breakpoints: state.debugSession.breakpoints.filter((b) => b.id !== id),
          },
        };
      }),
      toggleBreakpoint: (id) => set((state) => {
        if (!state.debugSession) return state;
        return {
          debugSession: {
            ...state.debugSession,
            breakpoints: state.debugSession.breakpoints.map((b) =>
              b.id === id ? { ...b, enabled: !b.enabled } : b
            ),
          },
        };
      }),
      addWatch: (expression) => set((state) => {
        if (!state.debugSession) return state;
        return {
          debugSession: {
            ...state.debugSession,
            watches: [...state.debugSession.watches, expression],
          },
        };
      }),
      removeWatch: (expression) => set((state) => {
        if (!state.debugSession) return state;
        return {
          debugSession: {
            ...state.debugSession,
            watches: state.debugSession.watches.filter((w) => w !== expression),
          },
        };
      }),
      
      // UI
      sidebarVisible: true,
      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
      sidebarWidth: 280,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      terminalHeight: 250,
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'bug-shepherd-ide',
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        terminalHeight: state.terminalHeight,
        aiProviders: state.aiProviders,
        activeAIProviderId: state.activeAIProviderId,
      }),
    }
  )
);

// Helper functions for tree operations
function updateFileInTree(files: FileNode[], fileId: string, updates: Partial<FileNode>): FileNode[] {
  return files.map((file) => {
    if (file.id === fileId) {
      return { ...file, ...updates };
    }
    if (file.children) {
      return { ...file, children: updateFileInTree(file.children, fileId, updates) };
    }
    return file;
  });
}

function addFileToTree(files: FileNode[], parentPath: string, newFile: FileNode): FileNode[] {
  if (parentPath === '/') {
    return [...files, newFile];
  }
  return files.map((file) => {
    if (file.path === parentPath && file.type === 'folder') {
      return { ...file, children: [...(file.children || []), newFile] };
    }
    if (file.children) {
      return { ...file, children: addFileToTree(file.children, parentPath, newFile) };
    }
    return file;
  });
}

function deleteFileFromTree(files: FileNode[], path: string): FileNode[] {
  return files
    .filter((file) => file.path !== path && !file.path.startsWith(path + '/'))
    .map((file) => {
      if (file.children) {
        return { ...file, children: deleteFileFromTree(file.children, path) };
      }
      return file;
    });
}

function renameFileInTree(files: FileNode[], path: string, newName: string): FileNode[] {
  const updatePath = (p: string) => {
    if (p === path) {
      const parts = p.split('/');
      parts[parts.length - 1] = newName;
      return parts.join('/');
    }
    if (p.startsWith(path + '/')) {
      return p.replace(path, path.replace(/[^/]+$/, newName));
    }
    return p;
  };
  
  return files.map((file) => {
    if (file.path === path) {
      const newPath = updatePath(file.path);
      return {
        ...file,
        name: newName,
        path: newPath,
        children: file.children?.map((child) => ({
          ...child,
          path: updatePath(child.path),
        })),
      };
    }
    if (file.children) {
      return { ...file, children: renameFileInTree(file.children, path, newName) };
    }
    return file;
  });
}
