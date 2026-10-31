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
} from 'lucide-react';
import { api } from '../services/api';
import { BrainConversation, BrainMessage } from '../types';
import { Badge } from '../components/Badge';

export const BusinessBrainPage: React.FC = () => {
  const [conversations, setConversations] = useState<BrainConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveContext, setLiveContext] = useState<any>(null);
  const [providerUsed, setProviderUsed] = useState<string>('Business Brain AI Engine');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    { title: 'Executive Overview', prompt: 'How is my business performing overall?' },
    { title: 'Best Sellers', prompt: 'What are my best-selling products and profit contributors?' },
    { title: 'Restock Urgency', prompt: 'Which products should I restock right now?' },
    { title: 'Slow Moving Stock', prompt: 'Which products are underperforming and holding idle capital?' },
    { title: 'Weekly Action Plan', prompt: 'What should I focus on this week to grow revenue?' },
    { title: 'Risk Audit', prompt: 'Identify potential business risks and vulnerabilities in my operations.' },
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
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text || text.trim() === '' || loading) return;

    setInputPrompt('');
    setLoading(true);

    // Optimistically add user message
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

      // If this was a new conversation, update active id & list
      if (!activeConvId || activeConvId !== result.conversationId) {
        setActiveConvId(result.conversationId);
        loadConversations();
      }
    } catch (err: any) {
      const errorMsg: BrainMessage = {
        id: Date.now() + 1,
        conversation_id: activeConvId || 'temp',
        role: 'assistant',
        content: `⚠️ Business Brain query failed: ${err.message}`,
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

  // Helper to format assistant markdown nicely
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm sm:text-base font-bold text-white tracking-tight mt-3 mb-1">
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
          if (line.startsWith('* **') || line.startsWith('- **') || line.startsWith('1. **')) {
            return (
              <div key={idx} className="pl-3 border-l border-zinc-700/60 my-1">
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
              </div>
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
            return <div key={idx} className="h-1.5" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-zinc-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800 text-sky-400 font-mono text-[11px]">$1</code>');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* LEFT SIDEBAR: Sessions & Verified Database Telemetry */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        {/* Action: New Session */}
        <button
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Strategic Consultation</span>
        </button>

        {/* Live Grounded Facts Panel */}
        {liveContext && (
          <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                Live Grounded Data
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Revenue</span>
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
                <span className="text-[10px] text-zinc-500 block">Orders</span>
                <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                  {liveContext.financials?.totalCompletedOrders || '0'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 block">Low Stock</span>
                <span className="font-mono font-bold text-amber-400 text-xs mt-0.5 block">
                  {liveContext.inventory?.lowStockItemsCount || '0'} SKUs
                </span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-tight">
              All AI responses are cross-referenced strictly against these verified database figures. No hallucinated business statistics.
            </p>
          </div>
        )}

        {/* Sessions History List */}
        <div className="glass-panel rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Session History
            </span>
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
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Business Brain AI Console
                <Badge variant="indigo" size="sm">Grounded Intelligence</Badge>
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Engine: <span className="text-sky-400">{providerUsed}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleNewConversation}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Clear Screen
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-xl shadow-sky-500/10">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Welcome to Business Brain
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                I am your enterprise intelligence partner. I have direct, controlled access to your sales,
                inventory, and customer database. Ask me any analytical question, request strategic restock guidance,
                or diagnose financial bottlenecks.
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
                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium leading-relaxed">
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                Analyzing live database telemetry & formulating strategic briefing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/70">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask Business Brain anything (e.g. 'What products should I restock?' or 'Summarize revenue')..."
              className="flex-1 px-4 py-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/60 shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-zinc-950 font-semibold text-xs sm:text-sm transition-all shadow-md shadow-sky-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Ask Brain</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
