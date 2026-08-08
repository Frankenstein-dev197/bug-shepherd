import { useCallback, useEffect, useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import { LANGUAGE_MONACO } from '../types';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  height?: string | number;
  onSave?: () => void;
}

export function CodeEditor({ height = '100%', onSave }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { tabs, activeTabId, updateTabContent, saveTab } = useIDEStore();
  
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Configure editor settings
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTabId) {
        saveTab(activeTabId);
        onSave?.();
      }
    });

    // Ctrl+W to close tab
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      if (activeTabId) {
        useIDEStore.getState().closeTab(activeTabId);
      }
    });

    // Focus editor
    editor.focus();
  }, [activeTabId, saveTab, onSave]);

  const handleChange: OnChange = useCallback((value) => {
    if (activeTabId && value !== undefined) {
      updateTabContent(activeTabId, value);
    }
  }, [activeTabId, updateTabContent]);

  // Update editor language when tab changes
  useEffect(() => {
    if (editorRef.current && activeTab) {
      const monaco = (window as any).monaco;
      if (monaco) {
        const model = editorRef.current.getModel();
        if (model) {
          const language = LANGUAGE_MONACO[activeTab.language] || activeTab.language;
          monaco.editor.setModelLanguage(model, language);
        }
      }
    }
  }, [activeTab?.language]);

  if (!activeTab) {
    return (
      <div 
        className="flex items-center justify-center bg-[#1e1e1e] text-gray-500"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-lg">No file open</p>
          <p className="text-sm mt-2">Select a file from the explorer</p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      height={height}
      language={LANGUAGE_MONACO[activeTab.language] || activeTab.language}
      value={activeTab.content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleEditorMount}
      loading={
        <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      }
      options={{
        minimap: { enabled: true },
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      }}
    />
  );
}
