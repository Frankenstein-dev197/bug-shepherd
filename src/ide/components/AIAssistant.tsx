import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Send, 
  Settings, 
  Plus, 
  Trash2, 
  X, 
  Bot, 
  User, 
  Loader2,
  Code,
  FileText,
  GitBranch,
  Search,
  Sparkles,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useIDEStore } from '../stores/ideStore';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface AIProviderConfig {
  openai: {
    name: string;
    models: string[];
    defaultModel: string;
    baseUrl: string;
  };
  anthropic: {
    name: string;
    models: string[];
    defaultModel: string;
    baseUrl: string;
  };
  gemini: {
    name: string;
    models: string[];
    defaultModel: string;
    baseUrl: string;
  };
}

const PROVIDER_CONFIG: AIProviderConfig = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241007'],
    defaultModel: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  gemini: {
    name: 'Google',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
};

const SYSTEM_PROMPT = `You are an expert AI coding assistant integrated into Bug Shepherd IDE.

Your capabilities:
- Read and understand any programming language
- Analyze code and identify bugs
- Explain complex concepts clearly
- Suggest improvements and optimizations
- Generate new code
- Refactor existing code
- Write tests
- Debug issues
- Answer questions about Git operations
- Help with database queries
- Review pull requests

Guidelines:
- Be concise and helpful
- Provide code examples when relevant
- Use proper formatting for code blocks
- Ask clarifying questions if needed
- Never execute destructive commands without confirmation
- Respect user privacy and security

When analyzing code, look for:
- Potential bugs and errors
- Performance issues
- Security vulnerabilities
- Code quality issues
- Best practices violations
- Type safety issues
- Error handling gaps`;

export function AIAssistant() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    addConversation,
    deleteConversation,
    addMessage,
    aiProviders,
    addAIProvider,
    removeAIProvider,
    activeAIProviderId,
    setActiveAIProvider,
    tabs,
  } = useIDEStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeProvider = aiProviders.find((p) => p.id === activeAIProviderId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConversationId) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    addMessage(activeConversationId, {
      role: 'user',
      content: userMessage,
      files: tabs.filter((t) => t.isActive).map((t) => t.filePath),
    });

    try {
      const history = (activeConversation?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('ide-ai', {
        body: {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: userMessage },
          ],
        },
      });

      if (error) {
        const detail =
          error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        throw new Error(detail);
      }

      addMessage(activeConversationId, {
        role: 'assistant',
        content: String(data?.content || 'No response received.'),
      });
    } catch (error) {
      console.error('AI Error:', error);
      toast({
        title: 'AI Error',
        description: error instanceof Error ? error.message : 'Failed to get AI response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, activeConversationId, activeConversation, addMessage, tabs]);

  const handleAddProvider = useCallback(() => {
    if (!apiKey.trim()) {
      toast({ title: 'API Key required', variant: 'destructive' });
      return;
    }

    const config = PROVIDER_CONFIG[selectedProvider];
    addAIProvider({
      id: `${selectedProvider}-${Date.now()}`,
      name: config.name,
      apiKey: apiKey.trim(),
      model: selectedModel,
      baseUrl: config.baseUrl,
    });

    toast({ title: 'Provider added', description: `${config.name} configured successfully` });
    setApiKey('');
    setShowSettings(false);
  }, [apiKey, selectedProvider, selectedModel, addAIProvider]);

  const handleNewConversation = useCallback(() => {
    const conv = addConversation();
    setActiveConversation(conv.id);
    setShowHistory(false);
  }, [addConversation, setActiveConversation]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied to clipboard' });
  }, []);

  const handleIncludeFile = useCallback((filePath: string, content: string) => {
    setInput((prev) => `${prev}\n\n\`\`\`${filePath}\n${content}\n\`\`\``);
  }, []);

  if (false) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-[#dcb67a]" />
            <h2 className="text-xl font-semibold text-[#cccccc] mb-2">AI Assistant</h2>
            <p className="text-[#858585] mb-6">
              Configure an AI provider to get started. Your API key is stored locally and never sent to our servers.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-[#0e639c] text-white rounded hover:bg-[#1177bb]"
            >
              Configure AI Provider
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#252526] border border-[#4c4c4c] rounded-lg p-6 w-96">
              <h3 className="text-[16px] font-semibold text-[#cccccc] mb-4">Configure AI Provider</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-[#858585]">Provider</label>
                  <div className="flex gap-2 mt-1">
                    {(['openai', 'anthropic', 'gemini'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setSelectedProvider(p);
                          setSelectedModel(PROVIDER_CONFIG[p].defaultModel);
                        }}
                        className={`px-3 py-1.5 text-[12px] rounded ${
                          selectedProvider === p
                            ? 'bg-[#0e639c] text-white'
                            : 'bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]'
                        }`}
                      >
                        {PROVIDER_CONFIG[p].name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] text-[#858585]">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c]"
                  >
                    {PROVIDER_CONFIG[selectedProvider].models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[12px] text-[#858585]">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full mt-1 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c] outline-none focus:border-[#007acc]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-[13px] text-[#cccccc] hover:bg-[#3c3c3c] rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProvider}
                  className="px-4 py-2 text-[13px] bg-[#0e639c] text-white rounded hover:bg-[#1177bb]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-[#dcb67a]" />
          <span className="text-[14px] font-medium text-[#cccccc]">AI Assistant</span>
          {activeProvider && (
            <span className="text-[10px] px-2 py-0.5 bg-[#3c3c3c] text-[#858585] rounded">
              {activeProvider.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
          >
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={handleNewConversation}
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-[#cccccc]"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border-b border-[#3c3c3c] bg-[#252526] max-h-48 overflow-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-[#6e6e6e]">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center justify-between px-4 py-2 hover:bg-[#2a2d2e] cursor-pointer ${
                  conv.id === activeConversationId ? 'bg-[#094771]' : ''
                }`}
                onClick={() => {
                  setActiveConversation(conv.id);
                  setShowHistory(false);
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#cccccc] truncate">
                    {conv.messages[0]?.content.slice(0, 50) || 'New conversation'}...
                  </p>
                  <p className="text-[10px] text-[#6e6e6e]">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="p-1 hover:bg-[#3c3c3c] rounded text-[#6e6e6e] hover:text-[#cccccc]"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {!activeConversation || activeConversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-[#dcb67a] mb-4" />
            <h3 className="text-[16px] font-medium text-[#cccccc] mb-2">How can I help?</h3>
            <p className="text-[12px] text-[#6e6e6e] max-w-sm">
              I can help you write code, debug issues, explain concepts, refactor, and more.
              Just ask!
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                { icon: Code, text: 'Write a React component' },
                { icon: Bug, text: 'Find bugs in my code' },
                { icon: GitBranch, text: 'Explain this git diff' },
                { icon: Search, text: 'Search the codebase' },
              ].map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => setInput(text)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] text-[12px] text-[#cccccc] rounded hover:bg-[#3c3c3c]"
                >
                  <Icon className="w-3 h-3" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    message.role === 'user' ? 'bg-[#0e639c]' : 'bg-[#dcb67a]'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-[#1e1e1e]" />
                  )}
                </div>
                <div
                  className={`flex-1 max-w-[80%] ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}
                >
                  <div
                    className={`inline-block px-4 py-2 rounded-lg text-[13px] ${
                      message.role === 'user'
                        ? 'bg-[#0e639c] text-white'
                        : 'bg-[#2d2d2d] text-[#cccccc]'
                    }`}
                  >
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6e6e6e]">
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    <button
                      onClick={() => handleCopy(message.content)}
                      className="hover:text-[#cccccc]"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#dcb67a] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#1e1e1e]" />
                </div>
                <div className="bg-[#2d2d2d] px-4 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-[#858585]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#3c3c3c] p-4 bg-[#252526]">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c] outline-none focus:border-[#007acc] resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#6e6e6e] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] border border-[#4c4c4c] rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[#cccccc]">AI Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-[#3c3c3c] rounded"
              >
                <X className="w-4 h-4 text-[#858585]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-[#858585]">Active Provider</label>
                {aiProviders.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {aiProviders.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-[12px] ${
                          p.id === activeAIProviderId
                            ? 'bg-[#0e639c] text-white'
                            : 'bg-[#3c3c3c] text-[#cccccc]'
                        }`}
                      >
                        <button
                          onClick={() => setActiveAIProvider(p.id)}
                          className="flex items-center gap-2"
                        >
                          {p.name}
                        </button>
                        <button
                          onClick={() => removeAIProvider(p.id)}
                          className="ml-1 hover:text-[#ff6b6b]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#6e6e6e] mt-1">No providers configured</p>
                )}
              </div>

              <div className="h-px bg-[#3c3c3c]" />

              <div>
                <label className="text-[12px] text-[#858585]">Add New Provider</label>
                <div className="flex gap-2 mt-1">
                  {(['openai', 'anthropic', 'gemini'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setSelectedProvider(p);
                        setSelectedModel(PROVIDER_CONFIG[p].defaultModel);
                      }}
                      className={`px-3 py-1.5 text-[12px] rounded ${
                        selectedProvider === p
                          ? 'bg-[#0e639c] text-white'
                          : 'bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]'
                      }`}
                    >
                      {PROVIDER_CONFIG[p].name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] text-[#858585]">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c]"
                >
                  {PROVIDER_CONFIG[selectedProvider].models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] text-[#858585]">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... or claude-..."
                  className="w-full mt-1 px-3 py-2 bg-[#3c3c3c] text-[#cccccc] text-[13px] rounded border border-[#4c4c4c] outline-none focus:border-[#007acc]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-[13px] text-[#cccccc] hover:bg-[#3c3c3c] rounded"
              >
                Close
              </button>
              <button
                onClick={handleAddProvider}
                disabled={!apiKey.trim()}
                className="px-4 py-2 text-[13px] bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50"
              >
                Add Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Bug import
import { Bug } from 'lucide-react';
