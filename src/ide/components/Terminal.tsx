import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Plus, Trash2, Search, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import { useEffectOnce } from '../hooks/useEffectOnce';
import { Shell } from '../lib/shell';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
  sessionId: string;
}

function TerminalComponent({ sessionId }: TerminalComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { addTerminalLine, clearTerminal } = useIDEStore();
  const session = useIDEStore((state) => 
    state.terminalSessions.find((s) => s.id === sessionId)
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize terminal
    const terminal = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    const shell = new Shell();
    void shell.init();

    terminal.writeln('\x1b[1;32mTriage Shell\x1b[0m \x1b[90m— real filesystem + real git engine (isomorphic-git)\x1b[0m');
    terminal.writeln('\x1b[90mType "help" for available commands. Repositories live in /workspace.\x1b[0m');
    terminal.writeln('');
    const writePrompt = () =>
      terminal.write(`\x1b[36m${shell.prompt}\x1b[0m \x1b[32m$\x1b[0m `);
    writePrompt();

    // Handle input
    let currentLine = '';
    let commandHistory: string[] = [];
    let historyIndex = -1;

    const executeCommand = async (cmd: string) => {
      const trimmedCmd = cmd.trim();
      if (!trimmedCmd) return;

      // Add to history
      commandHistory.push(trimmedCmd);
      historyIndex = commandHistory.length;

      // Log command
      addTerminalLine(sessionId, { type: 'input', content: `$ ${trimmedCmd}` });

      const result = await shell.run(trimmedCmd, (progress) =>
        terminal.writeln(`\x1b[90m${progress}\x1b[0m`),
      );

      if (result.cleared) {
        terminal.clear();
        clearTerminal(sessionId);
        return;
      }

      if (result.output) {
        result.output.split('\n').forEach((line: string) => {
          terminal.writeln(result.error ? `\x1b[31m${line}\x1b[0m` : line);
        });
        addTerminalLine(sessionId, {
          type: result.error ? 'error' : 'output',
          content: result.output,
        });
      }
    };

    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      // Handle Enter
      if (code === 13) {
        terminal.writeln('');
        const line = currentLine;
        currentLine = '';
        void executeCommand(line).finally(writePrompt);
      }
      // Handle Backspace
      else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      }
      // Handle Up Arrow (history)
      else if (code === 27) {
        const next = data[1];
        if (next === '[') {
          const arrow = data[2];
          if (arrow === 'A') {
            // Up
            if (historyIndex > 0) {
              historyIndex--;
              const cmd = commandHistory[historyIndex];
              // Clear current line
              while (currentLine.length > 0) {
                terminal.write('\b \b');
                currentLine = currentLine.slice(0, -1);
              }
              // Write new command
              currentLine = cmd;
              terminal.write(cmd);
            }
          } else if (arrow === 'B') {
            // Down
            if (historyIndex < commandHistory.length - 1) {
              historyIndex++;
              const cmd = commandHistory[historyIndex];
              while (currentLine.length > 0) {
                terminal.write('\b \b');
                currentLine = currentLine.slice(0, -1);
              }
              currentLine = cmd;
              terminal.write(cmd);
            } else {
              historyIndex = commandHistory.length;
              while (currentLine.length > 0) {
                terminal.write('\b \b');
                currentLine = currentLine.slice(0, -1);
              }
            }
          }
        }
      }
      // Handle regular characters
      else if (code >= 32) {
        currentLine += data;
        terminal.write(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [sessionId]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full bg-[#1e1e1e] ${isCollapsed ? 'h-0' : 'h-full'}`}
    />
  );
}

export function Terminal() {
  const {
    terminalSessions,
    activeTerminalId,
    addTerminalSession,
    closeTerminalSession,
    setActiveTerminal,
    terminalHeight,
    setTerminalHeight,
  } = useIDEStore();

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          const newHeight = rect.bottom - e.clientY;
          setTerminalHeight(Math.max(100, Math.min(newHeight, 600)));
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setTerminalHeight]);

  // Create initial terminal session
  useEffect(() => {
    if (terminalSessions.length === 0) {
      addTerminalSession();
    }
  }, [terminalSessions.length, addTerminalSession]);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c]"
      style={{ height: terminalHeight }}
    >
      {/* Tab bar */}
      <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex-1 flex items-center overflow-x-auto">
          {terminalSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveTerminal(session.id)}
              className={`px-3 py-2 text-[12px] flex items-center gap-2 border-r border-[#3c3c3c] ${
                session.id === activeTerminalId
                  ? 'bg-[#1e1e1e] text-[#cccccc]'
                  : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#323232]'
              }`}
            >
              <span>{session.name}</span>
              {terminalSessions.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminalSession(session.id);
                  }}
                  className="ml-1 hover:text-[#cccccc]"
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={addTerminalSession}
          className="px-2 py-2 text-[#969696] hover:bg-[#3c3c3c] hover:text-[#cccccc]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {terminalSessions.map((session) => (
          <div
            key={session.id}
            className={`h-full ${session.id === activeTerminalId ? 'block' : 'hidden'}`}
          >
            <TerminalComponent sessionId={session.id} />
          </div>
        ))}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-[#007acc]"
        style={{ height: '4px', marginBottom: -terminalHeight + 4 }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
