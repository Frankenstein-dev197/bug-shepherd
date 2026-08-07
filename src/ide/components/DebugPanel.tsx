import { useState, useCallback } from 'react';
import {
  Play,
  Pause,
  StopCircle,
  SkipForward,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Bug,
  Monitor,
  Variable,
  Layers as Stack,
  SquareTerminal as Console,
  RefreshCw,
  Copy,
  X,
} from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import type { DebugSession, Breakpoint, DebugVariable, DebugStackFrame } from '../types';

interface DebugPanelProps {
  filePath: string;
  lineNumber: number;
  onClose: () => void;
}

export function DebugPanel({ filePath, lineNumber, onClose }: DebugPanelProps) {
  const {
    debugSession,
    startDebugSession,
    stopDebugSession,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    addWatch,
    removeWatch,
    tabs,
  } = useIDEStore();

  const [activeView, setActiveView] = useState<'variables' | 'watch' | 'callstack' | 'breakpoints'>('variables');
  const [watchExpression, setWatchExpression] = useState('');

  const activeTab = tabs.find((t) => t.filePath === filePath);

  const handleStartDebug = useCallback(() => {
    if (!debugSession) {
      startDebugSession();
    }
    // Add initial breakpoint
    addBreakpoint({
      filePath,
      line: lineNumber,
      enabled: true,
    });
  }, [debugSession, startDebugSession, addBreakpoint, filePath, lineNumber]);

  const handleAddWatch = useCallback(() => {
    if (watchExpression.trim()) {
      addWatch(watchExpression.trim());
      setWatchExpression('');
    }
  }, [watchExpression, addWatch]);

  // Sample debug data
  const sampleVariables: DebugVariable[] = [
    { name: 'count', value: '0', type: 'number' },
    { name: 'name', value: '"Bug Shepherd"', type: 'string' },
    { name: 'isActive', value: 'true', type: 'boolean' },
    { name: 'items', value: 'Array(3)', type: 'array' },
  ];

  const sampleCallStack: DebugStackFrame[] = [
    { id: '1', name: 'App', filePath, line: 12, column: 5 },
    { id: '2', name: 'render', filePath, line: 8, column: 3 },
    { id: '3', name: 'updateState', filePath, line: 24, column: 2 },
  ];

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-[#dcb67a]" />
          <span className="text-[13px] font-medium text-[#cccccc]">Debug</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[#3c3c3c] rounded">
          <X className="w-4 h-4 text-[#858585]" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#3c3c3c]">
        <button
          onClick={handleStartDebug}
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#4ec9b0]"
          title="Start Debugging"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#dcdcaa]"
          title="Pause"
        >
          <Pause className="w-4 h-4" />
        </button>
        <button
          onClick={stopDebugSession}
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#f14c4c]"
          title="Stop"
        >
          <StopCircle className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-[#3c3c3c] mx-1" />
        <button
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#cccccc]"
          title="Step Over"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <button
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#cccccc]"
          title="Step Into"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          className="p-2 hover:bg-[#3c3c3c] rounded text-[#cccccc]"
          title="Step Out"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      {debugSession && (
        <div className="px-4 py-2 bg-[#2d4a3e] border-b border-[#3c3c3c]">
          <span className="text-[11px] text-[#4ec9b0]">
            ● Paused at {filePath}:{lineNumber}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-[#3c3c3c] bg-[#252526]">
        {[
          { id: 'variables', label: 'Variables', icon: Variable },
          { id: 'watch', label: 'Watch', icon: Eye },
          { id: 'callstack', label: 'Call Stack', icon: Stack },
          { id: 'breakpoints', label: 'Breakpoints', icon: Bug },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] ${
              activeView === id
                ? 'border-b-2 border-[#007acc] text-[#cccccc]'
                : 'text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === 'variables' && (
          <div className="p-2">
            {sampleVariables.map((v, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-[12px] hover:bg-[#2a2d2e] px-2 rounded">
                <span className="text-[#9cdcfe]">{v.name}</span>
                <span className="text-[#6e6e6e]">:</span>
                <span className="text-[#ce9178]">{v.value}</span>
                <span className="text-[#6e6e6e] ml-auto">{v.type}</span>
              </div>
            ))}
          </div>
        )}

        {activeView === 'watch' && (
          <div className="p-2">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={watchExpression}
                onChange={(e) => setWatchExpression(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                placeholder="Add expression..."
                className="flex-1 px-2 py-1 bg-[#3c3c3c] text-[#cccccc] text-[12px] rounded outline-none focus:border focus:border-[#007acc]"
              />
              <button
                onClick={handleAddWatch}
                className="p-1.5 bg-[#0e639c] text-white rounded hover:bg-[#1177bb]"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {debugSession?.watches.map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 text-[12px] hover:bg-[#2a2d2e] px-2 rounded"
              >
                <div>
                  <span className="text-[#9cdcfe]">{w}</span>
                  <span className="text-[#6e6e6e] mx-2">=</span>
                  <span className="text-[#b5cea8]">undefined</span>
                </div>
                <button
                  onClick={() => removeWatch(w)}
                  className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585]"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeView === 'callstack' && (
          <div className="p-2">
            {sampleCallStack.map((frame, i) => (
              <div
                key={frame.id}
                className={`py-1.5 px-2 text-[12px] rounded cursor-pointer ${
                  i === 0 ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#cccccc]">{frame.name}</span>
                  <span className="text-[#6e6e6e] text-[10px]">
                    {frame.filePath}:{frame.line}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'breakpoints' && (
          <div className="p-2">
            {debugSession?.breakpoints.map((bp) => (
              <div
                key={bp.id}
                className="flex items-center justify-between py-1 text-[12px] hover:bg-[#2a2d2e] px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBreakpoint(bp.id)}
                    className={bp.enabled ? 'text-[#4ec9b0]' : 'text-[#6e6e6e]'}
                  >
                    {bp.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <span className="text-[#cccccc]">{bp.filePath}</span>
                  <span className="text-[#6e6e6e]">:</span>
                  <span className="text-[#b5cea8]">{bp.line}</span>
                </div>
                <button
                  onClick={() => removeBreakpoint(bp.id)}
                  className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585]"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(!debugSession || debugSession.breakpoints.length === 0) && (
              <p className="text-[11px] text-[#6e6e6e] text-center py-4">
                No breakpoints configured
              </p>
            )}
          </div>
        )}
      </div>

      {/* Debug Console */}
      <div className="border-t border-[#3c3c3c]">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3c3c3c] bg-[#252526]">
          <Console className="w-3 h-3 text-[#858585]" />
          <span className="text-[11px] text-[#858585]">Debug Console</span>
        </div>
        <div className="h-32 overflow-auto p-2 bg-[#1e1e1e] font-mono text-[11px]">
          <p className="text-[#6e6e6e]">Starting debugger...</p>
          <p className="text-[#4ec9b0]">✓ Debug session initialized</p>
          {activeTab && (
            <p className="text-[#cccccc]">
              Breakpoint set at {filePath}:{lineNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
