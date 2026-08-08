import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Command,
  FileCode,
  FilePlus,
  FolderPlus,
  Save,
  Settings,
  GitBranch,
  Terminal as TerminalIcon,
  Bot,
  Bug,
  Play,
  Moon,
  Sun,
  PanelLeftClose,
  PanelRightClose,
  Maximize,
  Minimize,
  Copy,
  Scissors,
  Clipboard,
  Undo,
  Redo,
  Search as SearchIcon,
  Replace,
  FileText,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  Code,
  ChevronRight,
  ChevronDown,
  Keyboard,
  Palette,
} from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    saveTab,
    activeTabId,
    addFile,
    theme,
    setTheme,
    sidebarVisible,
    toggleSidebar,
    addTerminalSession,
    addConversation,
    setActiveConversation,
    tabs,
  } = useIDEStore();

  const commands: Command[] = useMemo(() => [
    // File Commands
    {
      id: 'file.new-file',
      label: 'New File',
      description: 'Create a new file',
      icon: <FilePlus className="w-4 h-4" />,
      shortcut: 'Ctrl+N',
      category: 'File',
      action: () => addFile('/', 'untitled.txt', 'file'),
    },
    {
      id: 'file.new-folder',
      label: 'New Folder',
      description: 'Create a new folder',
      icon: <FolderPlus className="w-4 h-4" />,
      shortcut: '',
      category: 'File',
      action: () => addFile('/', 'new-folder', 'folder'),
    },
    {
      id: 'file.save',
      label: 'Save',
      description: 'Save current file',
      icon: <Save className="w-4 h-4" />,
      shortcut: 'Ctrl+S',
      category: 'File',
      action: () => activeTabId && saveTab(activeTabId),
    },
    {
      id: 'file.save-all',
      label: 'Save All',
      description: 'Save all open files',
      icon: <Save className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+S',
      category: 'File',
      action: () => tabs.forEach(t => saveTab(t.id)),
    },
    {
      id: 'file.open',
      label: 'Open File',
      description: 'Open a file',
      icon: <FileText className="w-4 h-4" />,
      shortcut: 'Ctrl+O',
      category: 'File',
      action: () => {},
    },
    {
      id: 'file.close',
      label: 'Close Editor',
      description: 'Close current tab',
      icon: <Trash2 className="w-4 h-4" />,
      shortcut: 'Ctrl+W',
      category: 'File',
      action: () => activeTabId && useIDEStore.getState().closeTab(activeTabId),
    },
    // Edit Commands
    {
      id: 'edit.undo',
      label: 'Undo',
      icon: <Undo className="w-4 h-4" />,
      shortcut: 'Ctrl+Z',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      icon: <Redo className="w-4 h-4" />,
      shortcut: 'Ctrl+Y',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.cut',
      label: 'Cut',
      icon: <Scissors className="w-4 h-4" />,
      shortcut: 'Ctrl+X',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.copy',
      label: 'Copy',
      icon: <Copy className="w-4 h-4" />,
      shortcut: 'Ctrl+C',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.paste',
      label: 'Paste',
      icon: <Clipboard className="w-4 h-4" />,
      shortcut: 'Ctrl+V',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.find',
      label: 'Find',
      icon: <SearchIcon className="w-4 h-4" />,
      shortcut: 'Ctrl+F',
      category: 'Edit',
      action: () => {},
    },
    {
      id: 'edit.replace',
      label: 'Find and Replace',
      icon: <Replace className="w-4 h-4" />,
      shortcut: 'Ctrl+H',
      category: 'Edit',
      action: () => {},
    },
    // View Commands
    {
      id: 'view.toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: sidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />,
      shortcut: 'Ctrl+B',
      category: 'View',
      action: toggleSidebar,
    },
    {
      id: 'view.toggle-theme',
      label: 'Toggle Theme',
      icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      shortcut: '',
      category: 'View',
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'view.toggle-terminal',
      label: 'Toggle Terminal',
      icon: <TerminalIcon className="w-4 h-4" />,
      shortcut: 'Ctrl+`',
      category: 'View',
      action: () => {},
    },
    {
      id: 'view.fullscreen',
      label: 'Toggle Fullscreen',
      icon: <Maximize className="w-4 h-4" />,
      shortcut: 'F11',
      category: 'View',
      action: () => {},
    },
    // Git Commands
    {
      id: 'git.commit',
      label: 'Git: Commit',
      icon: <GitCommit className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    {
      id: 'git.push',
      label: 'Git: Push',
      icon: <Upload className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    {
      id: 'git.pull',
      label: 'Git: Pull',
      icon: <Download className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    {
      id: 'git.fetch',
      label: 'Git: Fetch',
      icon: <RefreshCw className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    {
      id: 'git.branch',
      label: 'Git: Create Branch',
      icon: <GitBranch className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    {
      id: 'git.pr',
      label: 'Git: Pull Requests',
      icon: <GitPullRequest className="w-4 h-4" />,
      shortcut: '',
      category: 'Git',
      action: () => {},
    },
    // Terminal Commands
    {
      id: 'terminal.new',
      label: 'Terminal: New Session',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+`',
      category: 'Terminal',
      action: addTerminalSession,
    },
    {
      id: 'terminal.kill',
      label: 'Terminal: Kill Active',
      icon: <Trash2 className="w-4 h-4" />,
      shortcut: '',
      category: 'Terminal',
      action: () => {},
    },
    // AI Commands
    {
      id: 'ai.new-chat',
      label: 'AI: New Conversation',
      icon: <Bot className="w-4 h-4" />,
      shortcut: '',
      category: 'AI',
      action: () => {
        const conv = addConversation();
        setActiveConversation(conv.id);
      },
    },
    // Preferences Commands
    {
      id: 'preferences.settings',
      label: 'Preferences: Open Settings',
      icon: <Settings className="w-4 h-4" />,
      shortcut: 'Ctrl+,',
      category: 'Preferences',
      action: () => {},
    },
    {
      id: 'preferences.keybindings',
      label: 'Preferences: Open Keyboard Shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      shortcut: 'Ctrl+K Ctrl+S',
      category: 'Preferences',
      action: () => {},
    },
    {
      id: 'preferences.theme',
      label: 'Preferences: Color Theme',
      icon: <Palette className="w-4 h-4" />,
      shortcut: 'Ctrl+K Ctrl+T',
      category: 'Preferences',
      action: () => {},
    },
    // Run Commands
    {
      id: 'run.start',
      label: 'Run: Start Debugging',
      icon: <Play className="w-4 h-4" />,
      shortcut: 'F5',
      category: 'Run',
      action: () => {},
    },
    {
      id: 'run.stop',
      label: 'Run: Stop',
      icon: <Bug className="w-4 h-4" />,
      shortcut: 'Shift+F5',
      category: 'Run',
      action: () => {},
    },
  ], [activeTabId, saveTab, tabs, addFile, theme, setTheme, sidebarVisible, toggleSidebar, addTerminalSession, addConversation, setActiveConversation]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  const executeCommand = useCallback((command: Command) => {
    command.action();
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Palette */}
      <div className="relative w-full max-w-xl bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#3c3c3c]">
          <Command className="w-5 h-5 text-[#858585]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-[14px] text-[#cccccc] outline-none placeholder:text-[#6e6e6e]"
          />
          <kbd className="px-2 py-0.5 text-[10px] bg-[#3c3c3c] text-[#858585] rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              {/* Category Header */}
              <div className="px-4 py-2 text-[10px] font-semibold text-[#6e6e6e] uppercase tracking-wider bg-[#1e1e1e] sticky top-0">
                {category}
              </div>
              
              {/* Commands */}
              {cmds.map((cmd) => {
                const isSelected = flatIndex === selectedIndex;
                const currentIndex = flatIndex;
                flatIndex++;
                
                return (
                  <div
                    key={cmd.id}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                      isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'
                    }`}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className={`w-5 h-5 flex items-center justify-center text-[#858585] ${isSelected ? 'text-white' : ''}`}>
                      {cmd.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] ${isSelected ? 'text-white' : 'text-[#cccccc]'}`}>
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div className={`text-[11px] truncate ${isSelected ? 'text-[#cccccc]' : 'text-[#6e6e6e]'}`}>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <div className="flex items-center gap-1">
                        {cmd.shortcut.split('+').map((key, i) => (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 text-[10px] bg-[#3c3c3c] text-[#858585] rounded"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-[#6e6e6e]">
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#3c3c3c] text-[11px] text-[#6e6e6e]">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Run</span>
            <span>Esc Close</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[#3c3c3c] rounded">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1 py-0.5 bg-[#3c3c3c] rounded">Shift</kbd>
            <span>+</span>
            <kbd className="px-1 py-0.5 bg-[#3c3c3c] rounded">P</kbd>
            <span className="ml-1">Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}
