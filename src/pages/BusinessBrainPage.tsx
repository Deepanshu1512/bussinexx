import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Trash2,
  Database,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  ExternalLink,
  Zap,
  Cpu,
  Globe,
  Terminal,
  X,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { BrainConversation, BrainMessage } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export const BusinessBrainPage: React.FC = () => {
  const [conversations, setConversations] = useState<BrainConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveContext, setLiveContext] = useState<any>(null);
  const [providerUsed, setProviderUsed] = useState<string>('Bussinex Autonomous Agent');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Free AI Connect Modal State
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq' | 'openrouter' | 'ollama' | 'deterministic'>('gemini');
  const [modalApiKey, setModalApiKey] = useState('');
  const [modalModel, setModalModel] = useState('gemini-2.5-flash');
  const [modalBaseUrl, setModalBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [modalTesting, setModalTesting] = useState(false);
  const [modalStatus, setModalStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    { title: '🤖 Connect Free AI Guide', prompt: 'How do I connect a 100% free AI like Groq, Google Gemini, OpenRouter, or Ollama to Bussinex?' },
    { title: 'Executive Overview', prompt: 'How is my business performing overall?' },
    { title: 'Restock Budget & Plan', prompt: 'Which products should I restock right now? Calculate exact unit needs and estimated capital.' },
    { title: 'Enterprise Risk Audit', prompt: 'Identify potential business risks, client concentration, and dead stock vulnerabilities.' },
    { title: 'Weekly Action Plan', prompt: 'What high-leverage priorities should I focus on this week to grow revenue?' },
    { title: 'Best Sellers', prompt: 'What are my best-selling products and profit margin contributors?' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const list = await api.getBrainConversations();
      setConversations(list);
      if (!activeConvId && list.length > 0) {
        selectConversation(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadLiveContext = async () => {
    try {
      const ctx = await api.getBrainContext();
      setLiveContext(ctx);
    } catch (err) {
      console.error('Failed to load context', err);
    }
  };

  const loadCurrentAISettings = async () => {
    try {
      const s = await api.getSettings();
      if (s.ai_provider) {
        setSelectedProvider(s.ai_provider as any);
      }
      if (s.ai_model) {
        setModalModel(s.ai_model);
      }
      if (s.ai_base_url) {
        setModalBaseUrl(s.ai_base_url);
      }
      if (s.ai_api_key && !s.ai_api_key.includes('••••')) {
        setModalApiKey(s.ai_api_key);
      }
    } catch (err) {
      console.warn('Could not load current AI settings', err);
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const msgs = await api.getBrainMessages(convId);
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  useEffect(() => {
    loadConversations();
    loadLiveContext();
    loadCurrentAISettings();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleProviderTabChange = (provider: 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'deterministic') => {
    setSelectedProvider(provider);
    setModalStatus(null);
    if (provider === 'gemini') {
      setModalModel('gemini-2.5-flash');
    } else if (provider === 'groq') {
      setModalModel('llama-3.3-70b-versatile');
    } else if (provider === 'openrouter') {
      setModalModel('deepseek/deepseek-r1:free');
    } else if (provider === 'ollama') {
      setModalModel('llama3');
      setModalBaseUrl('http://127.0.0.1:11434/v1');
    }
  };

  const handleTestAndSaveAI = async () => {
    try {
      setModalTesting(true);
      setModalStatus(null);

      // Test connection
      const testRes = await api.testAIConnection(
        modalApiKey,
        modalModel,
        selectedProvider,
        selectedProvider === 'ollama' ? modalBaseUrl : undefined
      );

      if (!testRes.success) {
        setModalStatus({ message: testRes.message, type: 'error' });
        return;
      }

      // Save to settings
      await api.updateSettings({
        ai_provider: selectedProvider,
        ai_model: modalModel,
        ai_api_key: modalApiKey,
        ai_base_url: selectedProvider === 'ollama' ? modalBaseUrl : undefined,
      });

      setProviderUsed(`${selectedProvider.toUpperCase()} (${modalModel})`);
      setModalStatus({ message: `Connected successfully! Business Brain will now use ${modalModel}.`, type: 'success' });
      setTimeout(() => {
        setConnectModalOpen(false);
        setModalStatus(null);
      }, 1500);
    } catch (err: any) {
      setModalStatus({ message: err.message || 'Connection test failed', type: 'error' });
    } finally {
      setModalTesting(false);
    }
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text || text.trim() === '' || loading) return;

    setInputPrompt('');
    setLoading(true);

    const tempUserMsg: BrainMessage = {
      id: Date.now(),
      conversation_id: activeConvId || 'temp',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await api.askBusinessBrain(text, activeConvId);
      setProviderUsed(result.providerUsed);

      const assistantMsg: BrainMessage = {
        id: Date.now() + 1,
        conversation_id: result.conversationId,
        role: 'assistant',
        content: result.response,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!activeConvId || activeConvId !== result.conversationId) {
        setActiveConvId(result.conversationId);
        loadConversations();
      }
    } catch (err: any) {
      const errorMsg: BrainMessage = {
        id: Date.now() + 1,
        conversation_id: activeConvId || 'temp',
        role: 'assistant',
        content: `⚠️ Business Brain notice: ${err.message}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await api.deleteBrainConversation(convId);
      if (activeConvId === convId) {
        handleNewConversation();
      }
      loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800 text-sky-400 font-mono text-[11px]">$1</code>');
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          if (line.startsWith('#### ')) {
            return (
              <h4 key={idx} className="text-xs sm:text-sm font-bold text-sky-300 tracking-tight mt-3 mb-1">
                {line.replace('#### ', '')}
              </h4>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm sm:text-base font-bold text-white tracking-tight mt-3.5 mb-1 flex items-center gap-2">
                {line.replace('### ', '')}
              </h3>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base sm:text-lg font-extrabold text-white tracking-tight mt-4 mb-2">
                {line.replace('## ', '')}
              </h2>
            );
          }
          if (line.startsWith('* **') || line.startsWith('- **') || line.startsWith('1. **') || line.startsWith('2. **') || line.startsWith('3. **')) {
            return (
              <div key={idx} className="pl-3 border-l-2 border-sky-500/40 my-1.5">
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
              </div>
            );
          }
          if (line.startsWith('* ') || line.startsWith('- ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-zinc-300">
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(2)) }} />
              </li>
            );
          }
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="p-3 my-2 rounded-xl bg-zinc-900 border-l-2 border-sky-400 text-xs text-zinc-300">
                {line.replace('> ', '')}
              </blockquote>
            );
          }
          if (line.trim() === '---') {
            return <hr key={idx} className="my-3 border-zinc-800" />;
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-6">
      {/* LEFT SIDEBAR: Live Database Telemetry & Sessions */}
      <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">
        {/* Free AI Quick Action Pill */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-sky-500/15 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block leading-tight">Free AI Connect Hub</span>
              <span className="text-[10px] text-emerald-300 font-mono block">Gemini, Groq, OpenRouter, Ollama</span>
            </div>
          </div>
          <button
            onClick={() => setConnectModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold transition-all shadow-sm cursor-pointer"
          >
            Connect
          </button>
        </div>

        {/* Live Grounded Facts Panel */}
        {liveContext && (
          <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                Live Grounded Facts
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Gross Revenue</span>
                <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                  ${liveContext.financials?.grossRevenue?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Gross Margin</span>
                <span className="font-mono font-bold text-emerald-400 text-xs mt-0.5 block">
                  {liveContext.financials?.profitMarginPercent || '0'}%
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Completed Orders</span>
                <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                  {liveContext.financials?.totalCompletedOrders || '0'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Low Stock Alerts</span>
                <span className="font-mono font-bold text-amber-400 text-xs mt-0.5 block">
                  {liveContext.inventory?.lowStockItemsCount || '0'} SKUs
                </span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-tight">
              All agent analyses are grounded directly in your live database records. No fabricated metrics.
            </p>
          </div>
        )}

        {/* Sessions History List */}
        <div className="glass-panel rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Session History
            </span>
            <button
              onClick={handleNewConversation}
              className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold"
            >
              + New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length > 0 ? (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    activeConvId === c.id
                      ? 'bg-zinc-800/90 text-white font-semibold border border-zinc-700/60 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate">{c.title}</div>
                    <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                      {c.updated_at.slice(0, 10)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500">
                No saved sessions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Interactive Intelligence Chat Console */}
      <div className="flex-1 glass-panel rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden">
        {/* Top Intelligence Console Bar */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Business Brain AI Agent
                <Badge variant="indigo" size="sm">Autonomous Intelligence</Badge>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-zinc-400 font-mono">
                  Engine: <span className="text-sky-400 font-medium">{providerUsed}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect Free AI</span>
            </button>

            <button
              onClick={handleNewConversation}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Clear Screen
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-xl shadow-sky-500/10">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Welcome to Business Brain
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                I am your enterprise AI advisor with live access to your sales, inventory, and customer database.
                Ask me any operational question, calculate restock budgets, diagnose margins, or connect your favorite free AI model!
              </p>

              {/* Quick Prompt Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-6 text-left">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="p-3 rounded-xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-left transition-all group cursor-pointer"
                  >
                    <div className="font-semibold text-xs text-white group-hover:text-sky-400 transition-colors flex items-center justify-between">
                      <span>{qp.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-sky-400 transition-colors" />
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-1">
                      {qp.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-500/20 mt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`relative group max-w-2xl rounded-2xl px-5 py-4 ${
                    m.role === 'user'
                      ? 'bg-sky-500/15 border border-sky-500/30 text-white'
                      : 'bg-zinc-900/90 border border-zinc-800/90 text-zinc-200 shadow-xl'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div>
                      {renderFormattedContent(m.content)}
                      <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="font-mono text-[10px]">
                          {m.created_at?.slice(11, 16) || 'Just now'}
                        </span>
                        <button
                          onClick={() => copyToClipboard(m.content, m.id)}
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-mono text-[10px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="font-mono text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>Business Brain is cross-referencing database telemetry and reasoning...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-2 pl-4 focus-within:border-sky-500/50 shadow-inner"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask anything (e.g., 'Which products to restock?', 'How to connect free AI?')..."
              disabled={loading}
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:hover:bg-sky-500 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* 🚀 CONNECT FREE AI MODAL */}
      <Modal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title="Connect Any Free AI Provider"
        size="lg"
      >
        <div className="space-y-5 text-zinc-200">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Bussinex Business Brain connects to any free AI service. Choose your preferred free provider below to connect unlimited intelligence with zero cost!
          </p>

          {/* Provider Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleProviderTabChange('gemini')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedProvider === 'gemini'
                  ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-[9px] font-mono px-1 rounded bg-sky-500/20 text-sky-300">FREE</span>
              </div>
              <div className="text-xs font-bold text-white">Google Gemini</div>
              <div className="text-[10px] text-zinc-500">15 RPM Free Tier</div>
            </button>

            <button
              type="button"
              onClick={() => handleProviderTabChange('groq')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedProvider === 'groq'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300">FAST</span>
              </div>
              <div className="text-xs font-bold text-white">Groq</div>
              <div className="text-[10px] text-zinc-500">Llama 3.3 / DeepSeek</div>
            </button>

            <button
              type="button"
              onClick={() => handleProviderTabChange('openrouter')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedProvider === 'openrouter'
                  ? 'bg-purple-500/15 border-purple-500/50 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-[9px] font-mono px-1 rounded bg-purple-500/20 text-purple-300">FREE</span>
              </div>
              <div className="text-xs font-bold text-white">OpenRouter</div>
              <div className="text-[10px] text-zinc-500">Free Open Models</div>
            </button>

            <button
              type="button"
              onClick={() => handleProviderTabChange('ollama')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedProvider === 'ollama'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span className="text-[9px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">LOCAL</span>
              </div>
              <div className="text-xs font-bold text-white">Ollama</div>
              <div className="text-[10px] text-zinc-500">Zero Keys (Offline)</div>
            </button>
          </div>

          {/* Provider Specific Instructions Banner */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-2">
            {selectedProvider === 'gemini' && (
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Google Gemini Free API Key</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Google provides free API keys with 15 requests per minute and generous token quotas.
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-[11px] font-semibold mt-1.5"
                  >
                    <span>Get 100% Free Gemini Key at Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {selectedProvider === 'groq' && (
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Groq Free Ultra-Fast API Key</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Groq runs Llama 3.3 70B and DeepSeek R1 at blazing speeds (~300 tokens/sec) completely free without a credit card.
                  </p>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold mt-1.5"
                  >
                    <span>Get Free Groq Key at console.groq.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {selectedProvider === 'openrouter' && (
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">OpenRouter Free Open-Source Models</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    OpenRouter hosts free models labeled with <code className="text-purple-300">:free</code> including DeepSeek R1, Llama 3.3, and Mistral.
                  </p>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-[11px] font-semibold mt-1.5"
                  >
                    <span>Get Free OpenRouter Key at openrouter.ai</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {selectedProvider === 'ollama' && (
              <div className="flex items-start gap-3">
                <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Local Ollama (No API Key Required)</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Runs 100% locally on your machine. Start Ollama with <code className="text-amber-300">ollama run llama3</code> or <code className="text-amber-300">ollama run deepseek-r1</code>.
                  </p>
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-[11px] font-semibold mt-1.5"
                  >
                    <span>Download Ollama for Windows/Mac/Linux</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Model Identifier</label>
            {selectedProvider === 'gemini' && (
              <select
                value={modalModel}
                onChange={(e) => setModalModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fastest & Recommended)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Stable)</option>
                <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
              </select>
            )}

            {selectedProvider === 'groq' && (
              <select
                value={modalModel}
                onChange={(e) => setModalModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                <option value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b (Reasoning)</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (Fast MoE)</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Sub-100ms)</option>
              </select>
            )}

            {selectedProvider === 'openrouter' && (
              <select
                value={modalModel}
                onChange={(e) => setModalModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              >
                <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free (100% Free)</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free">meta-llama/llama-3.3-70b-instruct:free (100% Free)</option>
                <option value="mistralai/mistral-7b-instruct:free">mistralai/mistral-7b-instruct:free (100% Free)</option>
                <option value="google/gemini-2.0-flash-exp:free">google/gemini-2.0-flash-exp:free (100% Free)</option>
              </select>
            )}

            {selectedProvider === 'ollama' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={modalModel}
                  onChange={(e) => setModalModel(e.target.value)}
                  placeholder="llama3 or deepseek-r1"
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Ollama Host URL</label>
                  <input
                    type="text"
                    value={modalBaseUrl}
                    onChange={(e) => setModalBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434/v1"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* API Key Input (if not ollama) */}
          {selectedProvider !== 'ollama' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                API Key for {selectedProvider.toUpperCase()}
              </label>
              <input
                type="password"
                value={modalApiKey}
                onChange={(e) => setModalApiKey(e.target.value)}
                placeholder="Paste your free API key here..."
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">
                🔒 Security Note: Keys are securely stored and never exposed in client bundles.
              </span>
            </div>
          )}

          {/* Status Message */}
          {modalStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                modalStatus.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/80 border border-rose-500/30 text-rose-200'
              }`}
            >
              {modalStatus.message}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setConnectModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={modalTesting}
              onClick={handleTestAndSaveAI}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white transition-all shadow-md shadow-sky-500/15 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {modalTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Connection...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Test & Connect Free AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
