import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Minus,
  Maximize2,
  PanelLeftClose,
  PanelLeft,
  Terminal as TerminalIcon,
  Bot,
  FileCode,
  GitBranch,
  Search,
  GitCommit,
  GitPullRequest,
  Bug,
  Save,
  FolderOpen,
  PanelBottomClose,
  PanelBottom,
  Command,
} from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { FileExplorer } from './FileExplorer';
import { Terminal } from './Terminal';
import { AIAssistant } from './AIAssistant';
import { CommandPalette } from './CommandPalette';
import { GitPanel } from './GitPanel';
import { useIDEStore } from '../stores/ideStore';

type SidePanel = 'explorer' | 'search' | 'git' | 'ai' | null;
type BottomPanel = 'terminal' | 'problems' | 'output' | null;

export function IDE() {
  const {
    tabs,
    activeTabId,
    closeTab,
    setActiveTab,
    saveTab,
    sidebarVisible,
    toggleSidebar,
    theme,
  } = useIDEStore();

  const [sidePanel, setSidePanel] = useState<SidePanel>('explorer');
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('terminal');
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+B to toggle sidebar
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // Ctrl+` to toggle terminal
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      setBottomPanelVisible((v) => !v);
    }
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (activeTabId) {
        saveTab(activeTabId);
      }
    }
    // Ctrl+Shift+P or Ctrl+P for command palette
    if ((e.ctrlKey && e.shiftKey && e.key === 'P') || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setShowCommandPalette(true);
    }
    // Ctrl+Shift+P alternative
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      setShowCommandPalette(true);
    }
  }, [toggleSidebar, activeTabId, saveTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc]">
      {/* Title Bar */}
      <div className="flex items-center h-8 bg-[#323233] border-b border-[#3c3c3c] select-none">
        <div className="flex items-center gap-2 px-3">
          <span className="text-[12px] font-medium">🐑 Bug Shepherd</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[12px] text-[#858585]">
            {activeTab ? `${activeTab.fileName} - Bug Shepherd IDE` : 'Bug Shepherd IDE'}
          </span>
        </div>
        <div className="flex items-center">
          <button className="px-3 h-8 hover:bg-[#3c3c3c]">
            <Minus className="w-3 h-3" />
          </button>
          <button className="px-3 h-8 hover:bg-[#3c3c3c]">
            <Maximize2 className="w-3 h-3" />
          </button>
          <button className="px-3 h-8 hover:bg-[#ff5f56] hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="flex items-center h-6 bg-[#323233] border-b border-[#3c3c3c] text-[12px]">
        <button className="px-3 h-6 hover:bg-[#4c4c4c]">File</button>
        <button className="px-3 h-6 hover:bg-[#4c4c4c]">Edit</button>
        <button className="px-3 h-6 hover:bg-[#4c4c4c]">View</button>
        <button className="px-3 h-6 hover:bg-[#4c4c4c]">Git</button>
        <button className="px-3 h-6 hover:bg-[#4c4c4c]">Help</button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && (
          <div className="w-60 flex flex-col border-r border-[#3c3c3c] bg-[#252526]">
            {/* Sidebar Tabs */}
            <div className="flex items-center border-b border-[#3c3c3c]">
              <button
                onClick={() => setSidePanel('explorer')}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] ${
                  sidePanel === 'explorer'
                    ? 'border-b-2 border-[#007acc] text-[#cccccc]'
                    : 'text-[#858585] hover:text-[#cccccc]'
                }`}
              >
                <FileCode className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidePanel('search')}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] ${
                  sidePanel === 'search'
                    ? 'border-b-2 border-[#007acc] text-[#cccccc]'
                    : 'text-[#858585] hover:text-[#cccccc]'
                }`}
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidePanel('git')}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] ${
                  sidePanel === 'git'
                    ? 'border-b-2 border-[#007acc] text-[#cccccc]'
                    : 'text-[#858585] hover:text-[#cccccc]'
                }`}
              >
                <GitBranch className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidePanel('ai')}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] ${
                  sidePanel === 'ai'
                    ? 'border-b-2 border-[#007acc] text-[#dcb67a]'
                    : 'text-[#858585] hover:text-[#dcb67a]'
                }`}
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {sidePanel === 'explorer' && <FileExplorer />}
              {sidePanel === 'search' && (
                <div className="h-full bg-[#252526] p-4">
                  <h3 className="text-[12px] font-semibold text-[#858585] mb-4">Search</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search files..."
                      className="w-full px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c] outline-none focus:border-[#007acc]"
                    />
                    <p className="text-[11px] text-[#6e6e6e]">
                      Press Ctrl+Shift+F for global search
                    </p>
                  </div>
                </div>
              )}
              {sidePanel === 'git' && <GitPanel />}
              {sidePanel === 'ai' && <AIAssistant />}
            </div>
          </div>
        )}

        {/* Toggle Sidebar Button */}
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-12 z-10 p-1 bg-[#252526] border border-[#3c3c3c] rounded-r hover:bg-[#3c3c3c]"
          style={{ display: sidebarVisible ? 'none' : 'block' }}
        >
          <PanelLeft className="w-4 h-4 text-[#858585]" />
        </button>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center h-10 bg-[#252526] border-b border-[#3c3c3c]">
            {sidebarVisible ? (
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-[#3c3c3c] text-[#858585] hover:text-[#cccccc]"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-[#3c3c3c] text-[#858585] hover:text-[#cccccc]"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            
            <div className="flex-1 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-2 px-3 h-10 border-r border-[#3c3c3c] cursor-pointer ${
                    tab.id === activeTabId
                      ? 'bg-[#1e1e1e] text-[#cccccc]'
                      : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#323232] hover:text-[#cccccc]'
                  }`}
                >
                  <FileCode className="w-4 h-4 shrink-0" />
                  <span className="text-[12px] truncate max-w-[150px]">
                    {tab.fileName}
                    {tab.isDirty && <span className="text-[#007acc]">●</span>}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="p-0.5 rounded hover:bg-[#4c4c4c] opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor />
          </div>

          {/* Bottom Panel */}
          {bottomPanelVisible && (
            <div className="border-t border-[#3c3c3c]">
              {/* Bottom Panel Tabs */}
              <div className="flex items-center h-8 bg-[#252526] border-b border-[#3c3c3c]">
                <button
                  onClick={() => setBottomPanel('terminal')}
                  className={`flex items-center gap-1.5 px-3 h-8 text-[12px] ${
                    bottomPanel === 'terminal'
                      ? 'border-t-2 border-[#007acc] text-[#cccccc]'
                      : 'text-[#858585] hover:text-[#cccccc]'
                  }`}
                >
                  <TerminalIcon className="w-3 h-3" />
                  Terminal
                </button>
                <button
                  onClick={() => setBottomPanel('problems')}
                  className={`flex items-center gap-1.5 px-3 h-8 text-[12px] ${
                    bottomPanel === 'problems'
                      ? 'border-t-2 border-[#007acc] text-[#cccccc]'
                      : 'text-[#858585] hover:text-[#cccccc]'
                  }`}
                >
                  <Bug className="w-3 h-3" />
                  Problems
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setBottomPanelVisible(false)}
                  className="p-2 hover:bg-[#3c3c3c] text-[#858585]"
                >
                  <PanelBottomClose className="w-3 h-3" />
                </button>
              </div>

              {/* Bottom Panel Content */}
              <div className="h-[200px] overflow-hidden">
                {bottomPanel === 'terminal' && <Terminal />}
                {bottomPanel === 'problems' && (
                  <div className="h-full bg-[#1e1e1e] p-4">
                    <p className="text-[12px] text-[#6e6e6e]">No problems detected</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle Bottom Panel Button */}
          {!bottomPanelVisible && (
            <button
              onClick={() => setBottomPanelVisible(true)}
              className="absolute bottom-0 left-60 right-0 h-6 bg-[#252526] border-t border-[#3c3c3c] flex items-center justify-center hover:bg-[#323232]"
            >
              <PanelBottom className="w-3 h-3 text-[#858585]" />
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between h-6 bg-[#007acc] text-[11px] text-white px-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            main
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="w-3 h-3" />
            abc1234
          </span>
          <span>0 problems</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
          <span>{theme === 'dark' ? 'Dark+' : 'Light+'}</span>
          <span>TypeScript</span>
          <button
            onClick={() => setShowCommandPalette(true)}
            className="flex items-center gap-1 hover:bg-[#006bb3] px-1 rounded"
            title="Command Palette (Ctrl+Shift+P)"
          >
            <Command className="w-3 h-3" />
            <span>Command Palette</span>
          </button>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </div>
  );
}
