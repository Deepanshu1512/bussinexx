import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Cpu,
  Zap,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { AppSettings } from '../types';
import { Badge } from '../components/Badge';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      setApiKeyInput(data.ai_api_key || '');
      setBaseUrlInput(data.ai_base_url || (data.ai_provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : ''));
    } catch (err: any) {
      showNotification(err.message || 'Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateSettings({
        business_name: settings.business_name,
        currency_symbol: settings.currency_symbol,
        tax_rate: settings.tax_rate,
        contact_email: settings.contact_email,
        business_address: settings.business_address,
      });
      showNotification('Business profile settings updated successfully!');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    let defaultModel = 'gemini-2.5-flash';
    let defaultBaseUrl = '';
    if (provider === 'groq') defaultModel = 'llama-3.3-70b-versatile';
    else if (provider === 'openrouter') defaultModel = 'deepseek/deepseek-r1:free';
    else if (provider === 'ollama') {
      defaultModel = 'llama3';
      defaultBaseUrl = 'http://127.0.0.1:11434/v1';
    }

    setSettings({
      ...settings,
      ai_provider: provider,
      ai_model: defaultModel,
    });
    setBaseUrlInput(defaultBaseUrl);
  };

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: Partial<AppSettings> = {
        ai_provider: settings.ai_provider || 'gemini',
        ai_model: settings.ai_model || 'gemini-2.5-flash',
        ai_temperature: settings.ai_temperature || '0.2',
        ai_base_url: baseUrlInput,
      };

      if (apiKeyInput && !apiKeyInput.includes('••••')) {
        payload.ai_api_key = apiKeyInput.trim();
      }

      await api.updateSettings(payload);
      showNotification('AI Engine settings updated successfully!');
      loadSettings();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAIConnection = async () => {
    try {
      setTestingAI(true);
      const res = await api.testAIConnection(
        apiKeyInput,
        settings.ai_model,
        settings.ai_provider || 'gemini',
        baseUrlInput
      );
      if (res.success) {
        showNotification(res.message, 'success');
      } else {
        showNotification(res.message, 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'AI Connection failed', 'error');
    } finally {
      setTestingAI(false);
    }
  };

  const handleSeedDemoData = async () => {
    if (!window.confirm('Seed starter demo dataset for this business? This will populate sample categories, products, and clients.')) return;
    try {
      setSeeding(true);
      const res = await api.seedDemoData();
      showNotification(res.message);
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete all operational records (orders, products, customers) for your tenant workspace. Are you sure?')) return;
    try {
      setResetting(true);
      const res = await api.resetDatabase();
      showNotification(res.message);
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
        <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
          Loading system preferences...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure business profiles, connect free AI providers, and manage database lifecycle.
        </p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* 1. BUSINESS PROFILE SETTINGS */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 text-sky-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Business Enterprise Profile
              </h3>
              <p className="text-xs text-zinc-400">
                Core identity, fiscal currency, and billing details for your workspace.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company / Business Name</label>
              <input
                type="text"
                required
                value={settings.business_name || ''}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Email</label>
              <input
                type="email"
                value={settings.contact_email || ''}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Currency Symbol</label>
              <input
                type="text"
                required
                value={settings.currency_symbol || '$'}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Default Sales Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={settings.tax_rate || '8.5'}
                onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Registered Business Address</label>
            <input
              type="text"
              value={settings.business_address || ''}
              onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all cursor-pointer shadow-md shadow-sky-500/15"
            >
              Save Profile Settings
            </button>
          </div>
        </form>
      </div>

      {/* 2. BUSINESS BRAIN AI CONFIGURATION */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Business Brain Free AI Configuration
                <Badge variant="indigo" size="sm">Backend Protected</Badge>
              </h3>
              <p className="text-xs text-zinc-400">
                Connect any 100% free AI model (Gemini, Groq, OpenRouter, or Local Ollama). Keys remain strictly on the backend.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveAIConfig} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">AI Provider</label>
              <select
                value={settings.ai_provider || 'gemini'}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="gemini">Google Gemini (Free Tier • 15 RPM)</option>
                <option value="groq">Groq (Free Ultra-Fast • Llama 3.3 70B & DeepSeek R1)</option>
                <option value="openrouter">OpenRouter (Free Open Models)</option>
                <option value="ollama">Ollama (100% Free Local AI • No Key Required)</option>
                <option value="deterministic">Built-in Autonomous Agent (No Key Required)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Target Model</label>
              <input
                type="text"
                value={settings.ai_model || 'gemini-2.5-flash'}
                onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                placeholder="e.g. gemini-2.5-flash or llama-3.3-70b-versatile"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Quick links to get free keys */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
            {(!settings.ai_provider || settings.ai_provider === 'gemini') && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Google Gemini provides 15 RPM free with zero credit card:</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold text-[11px]"
                >
                  <span>Get Free Key at Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {settings.ai_provider === 'groq' && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Groq runs Llama 3.3 70B & DeepSeek R1 at ~300 tok/sec free:</span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-[11px]"
                >
                  <span>Get Free Key at console.groq.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {settings.ai_provider === 'openrouter' && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">OpenRouter provides free models like DeepSeek R1 and Llama 3.3:</span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold text-[11px]"
                >
                  <span>Get Free Key at openrouter.ai</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {settings.ai_provider === 'ollama' && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Ollama runs local open models with zero keys:</span>
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold text-[11px]"
                >
                  <span>Download Ollama</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {settings.ai_provider === 'ollama' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Ollama Host Base URL</label>
              <input
                type="text"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="http://127.0.0.1:11434/v1"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          )}

          {settings.ai_provider !== 'ollama' && settings.ai_provider !== 'deterministic' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-300">
                  API Key for {(settings.ai_provider || 'gemini').toUpperCase()}
                </label>
                <span className="text-[11px] text-zinc-500">
                  {settings.has_custom_api_key === 'true' ? 'Key currently configured' : 'Using built-in intelligence fallback'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste free API key here..."
                  className="w-full pl-3 pr-24 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Your key is stored securely in settings and strictly executed on the server.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleTestAIConnection}
              disabled={testingAI}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-zinc-700 transition-colors cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{testingAI ? 'Testing Connection...' : 'Test AI Connection'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all cursor-pointer shadow-md shadow-sky-500/15"
            >
              Save AI Settings
            </button>
          </div>
        </form>
      </div>

      {/* 3. DATABASE & SEED MANAGEMENT */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Database Management & Seed Lifecycle
              </h3>
              <p className="text-xs text-zinc-400">
                Populate starter enterprise datasets or reset operational records.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <h4 className="text-xs font-semibold text-white">Seed Starter Dataset</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Load high-velocity enterprise catalog, categories, and test customer profiles for demonstration.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 transition-colors shrink-0 cursor-pointer"
            >
              {seeding ? 'Seeding...' : 'Seed Sample Data'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
            <div>
              <h4 className="text-xs font-semibold text-rose-300">Clear Workspace Data</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Permanently purge all orders, products, and clients associated with your business tenant.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDatabase}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{resetting ? 'Resetting...' : 'Purge All Records'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
