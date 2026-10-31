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

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: Partial<AppSettings> = {
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        ai_temperature: settings.ai_temperature,
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
      const res = await api.testAIConnection(apiKeyInput, settings.ai_model);
      showNotification(res.message, res.success ? 'success' : 'error');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingAI(false);
    }
  };

  const handleSeedDemoData = async () => {
    if (!window.confirm('This will seed realistic business demo data (18 products, 12 customers, 32 orders). Continue?')) return;
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
    if (!window.confirm('WARNING: This will clear all transactions, products, and customer records from the database. Are you completely sure?')) return;
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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-semibold shadow-xl transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Configuration</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure business profile, hosted LLM credentials, and database management.
        </p>
      </div>

      {/* 1. BUSINESS PROFILE */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <div className="p-2 rounded-xl bg-zinc-800 text-sky-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Business Profile</h3>
            <p className="text-xs text-zinc-400">Organization identification, currency, and tax rate</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company / Enterprise Name</label>
              <input
                type="text"
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
                value={settings.currency_symbol || '$'}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Standard Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={settings.tax_rate || '8.5'}
                onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Corporate Headquarters Address</label>
            <input
              type="text"
              value={settings.business_address || ''}
              onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end pt-2">
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
                Business Brain AI Configuration
                <Badge variant="indigo" size="sm">Backend Protected</Badge>
              </h3>
              <p className="text-xs text-zinc-400">
                Configure your hosted LLM provider. Credentials are encrypted and kept strictly on the backend.
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
                onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="gemini">Google Gemini (Recommended / Official SDK)</option>
                <option value="heuristic">Built-in Deterministic Engine (No API Key Required)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Target LLM Model</label>
              <select
                value={settings.ai_model || 'gemini-2.5-flash'}
                onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Highly Intelligent)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Multi-Step Reasoning)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (High Throughput)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-300">
                Google Gemini API Key
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
                placeholder="AIzaSy..."
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
              Your key is stored securely in SQLite settings on your local server. It is never exposed in client code.
            </p>
          </div>

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

      {/* 3. DATABASE MANAGEMENT & SEED DATA */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <div className="p-2 rounded-xl bg-zinc-800 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Database Management</h3>
            <p className="text-xs text-zinc-400">Local persistent SQLite database maintenance and dataset tools</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Seed Demo Data Card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
                Populate Realistic Demo Business Data
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Injects 18 realistic products, 12 customers, and 32 historical orders spanning the last 90 days.
                Perfect for immediate analytics and Business Brain evaluation.
              </p>
            </div>
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Seeding Data...' : 'Seed Sample Business Data'}</span>
            </button>
          </div>

          {/* Reset Database Card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-rose-400 uppercase font-mono tracking-wider">
                Reset Operational Records
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Wipes all orders, stock logs, products, and customer profiles.
                Tests empty states and resets the platform to clean slate.
              </p>
            </div>
            <button
              onClick={handleResetDatabase}
              disabled={resetting}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{resetting ? 'Resetting...' : 'Clear All Operational Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
