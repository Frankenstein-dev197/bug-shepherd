import { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  Copy,
  Clipboard,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import type { FileNode } from '../types';

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

function FileTreeItem({ node, depth, onContextMenu }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const { addTab, addFile, deleteFile, renameFile } = useIDEStore();

  const handleClick = useCallback(() => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    } else {
      addTab({
        id: node.id,
        path: node.path,
        name: node.name,
        content: node.content || '',
      });
    }
  }, [node, isOpen, addTab]);

  const handleRename = useCallback(() => {
    if (newName && newName !== node.name) {
      renameFile(node.path, newName);
    }
    setIsRenaming(false);
  }, [newName, node.path, node.name, renameFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewName(node.name);
      setIsRenaming(false);
    }
  }, [handleRename, node.name]);

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 hover:bg-[#2a2d2e] cursor-pointer text-[13px] text-[#cccccc]"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.type === 'folder' ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0 text-[#858585]" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0 text-[#858585]" />
            )}
            {isOpen ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-[#dcb67a]" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-[#dcb67a]" />
            )}
          </>
        ) : (
          <>
            <div className="w-4" />
            <File className="w-4 h-4 shrink-0 text-[#519aba]" />
          </>
        )}
        
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#3c3c3c] text-[#cccccc] px-1 text-[13px] outline-none border border-[#007acc]"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{node.name}</span>
        )}
      </div>
      
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const { files, addFile, deleteFile, renameFile, setFiles } = useIDEStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    
    const filterTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce<FileNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const filteredChildren = node.children ? filterTree(node.children) : undefined;
        
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({
            ...node,
            children: filteredChildren,
          });
        }
        return acc;
      }, []);
    };
    
    return filterTree(files);
  }, [files, searchQuery]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCreateFile = useCallback(() => {
    if (newItemName && contextMenu) {
      addFile(contextMenu.node.path, newItemName, 'file');
    } else if (newItemName) {
      addFile('/', newItemName, 'file');
    }
    setIsCreating(null);
    setNewItemName('');
    closeContextMenu();
  }, [newItemName, contextMenu, addFile, closeContextMenu]);

  const handleCreateFolder = useCallback(() => {
    if (newItemName && contextMenu) {
      addFile(contextMenu.node.path, newItemName, 'folder');
    } else if (newItemName) {
      addFile('/', newItemName, 'folder');
    }
    setIsCreating(null);
    setNewItemName('');
    closeContextMenu();
  }, [newItemName, contextMenu, addFile, closeContextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      deleteFile(contextMenu.node.path);
    }
    closeContextMenu();
  }, [contextMenu, deleteFile, closeContextMenu]);

  const handleRename = useCallback(() => {
    if (contextMenu) {
      setNewItemName(contextMenu.node.name);
      // Trigger rename mode
      closeContextMenu();
    }
  }, [contextMenu, closeContextMenu]);

  const loadSampleFiles = useCallback(() => {
    const sampleFiles: FileNode[] = [
      {
        id: '1',
        name: 'src',
        path: '/src',
        type: 'folder',
        children: [
          {
            id: '2',
            name: 'index.tsx',
            path: '/src/index.tsx',
            type: 'file',
            content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
          },
          {
            id: '3',
            name: 'App.tsx',
            path: '/src/App.tsx',
            type: 'file',
            content: `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Bug Shepherd IDE
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Welcome to the new IDE! Count: {count}
          </p>
          <button
            onClick={() => setCount(c => c + 1)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Increment
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;`,
          },
          {
            id: '4',
            name: 'components',
            path: '/src/components',
            type: 'folder',
            children: [
              {
                id: '5',
                name: 'Button.tsx',
                path: '/src/components/Button.tsx',
                type: 'file',
                content: `import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => {
    const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';
    const variants = {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    return (
      <button
        ref={ref}
        className={\`\${baseStyles} \${variants[variant]} \${className}\`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';`,
              },
            ],
          },
        ],
      },
      {
        id: '6',
        name: 'package.json',
        path: '/package.json',
        type: 'file',
        content: JSON.stringify({
          name: 'bug-shepherd-ide',
          version: '1.0.0',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
        }, null, 2),
      },
      {
        id: '7',
        name: 'README.md',
        path: '/README.md',
        type: 'file',
        content: `# Bug Shepherd IDE

A modern, cloud-based IDE with AI integration.

## Features

- Monaco Editor integration
- Git integration
- AI-powered code assistance
- Terminal emulation

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\``,
      },
    ];
    setFiles(sampleFiles);
  }, [setFiles]);

  return (
    <div className="flex flex-col h-full bg-[#252526]" onClick={closeContextMenu}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-[#bbbbbb] font-semibold border-b border-[#3c3c3c]">
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating('file')}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="New File"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreating('folder')}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={loadSampleFiles}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Load Sample Files"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2 px-2 py-1 bg-[#3c3c3c] rounded text-[12px]">
          <Search className="w-3 h-3 text-[#858585]" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#cccccc] outline-none placeholder:text-[#6e6e6e]"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-1">
        {filteredFiles.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-[#6e6e6e]">
            <p>No files</p>
            <button
              onClick={loadSampleFiles}
              className="mt-2 text-blue-400 hover:underline"
            >
              Load sample files
            </button>
          </div>
        ) : (
          filteredFiles.map((node) => (
            <FileTreeItem
              key={node.id}
              node={node}
              depth={0}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#3c3c3c] border border-[#4c4c4c] rounded shadow-lg py-1 min-w-[160px] z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'folder' && (
            <>
              <button
                className="w-full px-3 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#094771] text-left flex items-center gap-2"
                onClick={() => setIsCreating('file')}
              >
                <FilePlus className="w-4 h-4" /> New File
              </button>
              <button
                className="w-full px-3 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#094771] text-left flex items-center gap-2"
                onClick={() => setIsCreating('folder')}
              >
                <FolderPlus className="w-4 h-4" /> New Folder
              </button>
              <div className="h-px bg-[#4c4c4c] my-1" />
            </>
          )}
          <button
            className="w-full px-3 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#094771] text-left flex items-center gap-2"
            onClick={handleRename}
          >
            <Edit3 className="w-4 h-4" /> Rename
          </button>
          <button
            className="w-full px-3 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#094771] text-left flex items-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Create Dialog */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] border border-[#4c4c4c] rounded-lg p-4 w-80">
            <h3 className="text-[14px] font-semibold text-[#cccccc] mb-4">
              New {isCreating === 'file' ? 'File' : 'Folder'}
            </h3>
            <input
              type="text"
              placeholder={`Enter ${isCreating} name...`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c] focus:border-[#007acc] outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  isCreating === 'file' ? handleCreateFile() : handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setIsCreating(null);
                  setNewItemName('');
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsCreating(null);
                  setNewItemName('');
                }}
                className="px-3 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#3c3c3c] rounded"
              >
                Cancel
              </button>
              <button
                onClick={isCreating === 'file' ? handleCreateFile : handleCreateFolder}
                className="px-3 py-1.5 text-[12px] bg-[#0e639c] text-white rounded hover:bg-[#1177bb]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
