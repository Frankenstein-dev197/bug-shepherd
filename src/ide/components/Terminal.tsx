import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Plus, Trash2, Search, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import { useEffectOnce } from '../hooks/useEffectOnce';
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

  useEffectOnce(() => {
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

    terminal.writeln('\x1b[1;32m🐑 Bug Shepherd Terminal\x1b[0m');
    terminal.writeln('\x1b[90mType "help" for available commands\x1b[0m');
    terminal.writeln('');

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

      // Simulate command execution
      const [command, ...args] = trimmedCmd.split(' ');

      switch (command.toLowerCase()) {
        case 'help':
          terminal.writeln('\x1b[36mAvailable commands:\x1b[0m');
          terminal.writeln('  \x1b[33mhelp\x1b[0m     - Show this help');
          terminal.writeln('  \x1b[33mclear\x1b[0m   - Clear terminal');
          terminal.writeln('  \x1b[33mls\x1b[0m       - List files');
          terminal.writeln('  \x1b[33mpwd\x1b[0m      - Print working directory');
          terminal.writeln('  \x1b[33mdate\x1b[0m     - Show current date');
          terminal.writeln('  \x1b[33mecho\x1b[0m     - Print text');
          terminal.writeln('  \x1b[33mwhoami\x1b[0m   - Show current user');
          terminal.writeln('  \x1b[33mgit status\x1b[0m - Show git status');
          terminal.writeln('');
          terminal.writeln('\x1b[36mGit Commands:\x1b[0m');
          terminal.writeln('  \x1b[33mgit status\x1b[0m  - Show working tree status');
          terminal.writeln('  \x1b[33mgit log\x1b[0m     - Show commit logs');
          terminal.writeln('  \x1b[33mgit branch\x1b[0m - List branches');
          terminal.writeln('  \x1b[33mgit diff\x1b[0m   - Show changes');
          break;

        case 'clear':
          terminal.clear();
          break;

        case 'ls':
          terminal.writeln('\x1b[34msrc/\x1b[0m        \x1b[32mcomponents/\x1b[0m       \x1b[33mpackage.json\x1b[0m');
          terminal.writeln('\x1b[36mREADME.md\x1b[0m    \x1b[35mnode_modules/\x1b[0m');
          break;

        case 'pwd':
          terminal.writeln('/workspace/project');
          break;

        case 'date':
          terminal.writeln(new Date().toString());
          break;

        case 'echo':
          terminal.writeln(args.join(' '));
          addTerminalLine(sessionId, { type: 'output', content: args.join(' ') });
          break;

        case 'whoami':
          terminal.writeln('developer');
          break;

        case 'git':
          if (args[0] === 'status') {
            terminal.writeln('On branch \x1b[32mmain\x1b[0m');
            terminal.writeln('Changes not staged for commit:');
            terminal.writeln('  \x1b[31mmodified:   src/App.tsx\x1b[0m');
            terminal.writeln('  \x1b[32mnew file:   src/ide/\x1b[0m');
            terminal.writeln('');
            terminal.writeln('no changes added to commit');
          } else if (args[0] === 'log') {
            terminal.writeln('\x1b[33mcommit a1b2c3d\x1b[0m (HEAD -> main)');
            terminal.writeln('Author: Developer <dev@example.com>');
            terminal.writeln('Date:   ' + new Date().toDateString());
            terminal.writeln('');
            terminal.writeln('    Initial commit');
          } else if (args[0] === 'branch') {
            terminal.writeln('  \x1b[32m*\x1b[0m main');
            terminal.writeln('    feature/ide');
            terminal.writeln('    bugfix/terminal');
          } else if (args[0] === 'diff') {
            terminal.writeln('\x1b[31m-diff --git a/src/App.tsx b/src/App.tsx\x1b[0m');
            terminal.writeln('\x1b[31m--- a/src/App.tsx\x1b[0m');
            terminal.writeln('\x1b[32m+++ b/src/App.tsx\x1b[0m');
            terminal.writeln('\x1b[36m@@ -1,5 +1,6 @@\x1b[0m');
            terminal.writeln(' import { useState } from \'react\';');
            terminal.writeln('+import { IDE } from \'./ide\';');
            terminal.writeln(' ');
            terminal.writeln(' function App() {');
          } else {
            terminal.writeln(`\x1b[31mgit: '${args[0]}' is not a git command\x1b[0m`);
          }
          break;

        default:
          terminal.writeln(`\x1b[31mCommand not found: ${command}\x1b[0m`);
          terminal.writeln(`\x1b[90mType "help" for available commands\x1b[0m`);
          addTerminalLine(sessionId, { type: 'error', content: `Command not found: ${command}` });
      }

      addTerminalLine(sessionId, { type: 'output', content: '' });
    };

    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      // Handle Enter
      if (code === 13) {
        terminal.writeln('');
        executeCommand(currentLine);
        currentLine = '';
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
