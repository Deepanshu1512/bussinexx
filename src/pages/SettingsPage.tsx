import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Building,
  Key,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Cpu,
  Store as StoreIcon,
  Plus,
  Edit2,
  ShieldCheck,
  FileText,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { api } from '../services/api';
import { AppSettings, Store } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useStore } from '../context/StoreContext';
import { INDIAN_STATES, formatPhone } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'stores' ? 'stores' : 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'stores' | 'ai' | 'compliance'>(initialTab as any);

  const { stores, refreshStores } = useStore();
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

  // Store Modal State
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeForm, setStoreForm] = useState({
    name: '',
    code: '',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    phone: '',
    email: '',
    is_primary: false,
  });

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
        currency_symbol: settings.currency_symbol || '₹',
        tax_rate: settings.tax_rate || '18.0',
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

  const handleOpenAddStore = () => {
    setEditingStore(null);
    setStoreForm({
      name: '',
      code: `STR-${stores.length + 1}`,
      address: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      phone: '',
      email: '',
      is_primary: stores.length === 0,
    });
    setStoreModalOpen(true);
  };

  const handleOpenEditStore = (s: Store) => {
    setEditingStore(s);
    setStoreForm({
      name: s.name,
      code: s.code || '',
      address: s.address || '',
      city: s.city || 'Bengaluru',
      state: s.state || 'Karnataka',
      pincode: s.pincode || '',
      phone: s.phone || '',
      email: s.email || '',
      is_primary: Boolean(s.is_primary),
    });
    setStoreModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeForm.name.trim()) {
      showNotification('Store name is required', 'error');
      return;
    }

    try {
      const payload = {
        name: storeForm.name.trim(),
        code: storeForm.code.trim() || undefined,
        address: storeForm.address.trim() || undefined,
        city: storeForm.city.trim() || undefined,
        state: storeForm.state.trim() || undefined,
        pincode: storeForm.pincode.trim() || undefined,
        phone: storeForm.phone.trim() || undefined,
        email: storeForm.email.trim() || undefined,
        is_primary: storeForm.is_primary ? 1 : 0,
      };

      if (editingStore) {
        await api.stores.updateStore(editingStore.id, payload);
        showNotification(`Store '${payload.name}' updated successfully!`);
      } else {
        await api.stores.createStore(payload);
        showNotification(`New store '${payload.name}' created!`);
      }

      setStoreModalOpen(false);
      refreshStores();
    } catch (err: any) {
      showNotification(err.message || 'Error saving store', 'error');
    }
  };

  const handleDeleteStore = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete store '${name}'? Inventory must be transferred first.`)) return;
    try {
      const res = await api.stores.deleteStore(id);
      showNotification(res.message);
      refreshStores();
    } catch (err: any) {
      showNotification(err.message || 'Cannot delete store.', 'error');
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
        ai_base_url: baseUrlInput.trim() || undefined,
      };

      if (apiKeyInput.trim() && !apiKeyInput.includes('••••')) {
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
        apiKeyInput.trim() || undefined,
        settings.ai_model,
        settings.ai_provider,
        baseUrlInput.trim() || undefined
      );
      showNotification(res.message);
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingAI(false);
    }
  };

  const handleSeedDemoData = async () => {
    if (!window.confirm('Populate starter enterprise sample data into your demo workspace?')) return;
    try {
      setSeeding(true);
      const res = await api.seedDemoData();
      showNotification(res.message);
      refreshStores();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('WARNING: This will permanently delete all orders, products, and customer records from this workspace. Proceed?')) return;
    try {
      setResetting(true);
      const res = await api.resetDatabase();
      showNotification(res.message);
      refreshStores();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-xl border text-xs font-semibold shadow-xl flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise profile, branch locations, AI reasoning engine & regulatory compliance.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex rounded-2xl bg-zinc-900/60 p-1 border border-zinc-800 text-xs w-full sm:w-fit overflow-x-auto whitespace-nowrap scrollbar-none gap-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
            activeTab === 'profile' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Business Profile
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'stores' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span>Stores & Branches</span>
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">
            {stores.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
            activeTab === 'ai' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          AI Intelligence
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
            activeTab === 'compliance' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Legal & Compliance
        </button>
      </div>

      {/* 1. BUSINESS PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-indigo-400">
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">Business / Company Name</label>
                <input
                  type="text"
                  required
                  value={settings.business_name || ''}
                  onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={settings.contact_email || ''}
                  onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Currency Symbol (INR)</label>
                <input
                  type="text"
                  required
                  value={settings.currency_symbol || '₹'}
                  onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Standard GST Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.tax_rate || '18.0'}
                  onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Headquarters / Registered Office Address</label>
              <input
                type="text"
                value={settings.business_address || ''}
                onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
                placeholder="Brigade Tech Park, Whitefield, Bengaluru, Karnataka 560066"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md shadow-indigo-500/15"
              >
                {saving ? 'Saving...' : 'Save Profile Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. MULTI-STORE MANAGEMENT TAB */}
      {activeTab === 'stores' && (
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-indigo-400">
                <StoreIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Multi-Store Management
                </h3>
                <p className="text-xs text-zinc-400">
                  Manage physical locations, online branches, and independent store stock records.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenAddStore}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Store</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{s.name}</h4>
                      {Boolean(s.is_primary) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Primary Flagship
                        </span>
                      )}
                    </div>
                    {s.code && <span className="font-mono text-[11px] text-zinc-500 block mt-0.5">Code: {s.code}</span>}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditStore(s)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Edit Store Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!Boolean(s.is_primary) && stores.length > 1 && (
                      <button
                        onClick={() => handleDeleteStore(s.id, s.name)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Delete Store"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-zinc-400">
                  {s.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{s.address}, {s.city} {s.pincode}</span>
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{formatPhone(s.phone)}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{s.email}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono text-[11px]">
                    Status: <strong className="text-emerald-400 capitalize">{s.status}</strong>
                  </span>
                  <Link
                    to="/inventory"
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                  >
                    View Store Inventory →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BUSINESS BRAIN AI CONFIGURATION TAB */}
      {activeTab === 'ai' && (
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  Business Brain AI Configuration
                  <Badge variant="indigo" size="sm">Backend Protected</Badge>
                </h3>
                <p className="text-xs text-zinc-400">
                  Connect any free AI model (Google Gemini, Groq, OpenRouter, or Local Ollama). API keys are never exposed to browser clients.
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
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini">Google Gemini (Free Tier • 15 RPM)</option>
                  <option value="groq">Groq (Ultra-Fast • Llama 3.3 70B & DeepSeek R1)</option>
                  <option value="openrouter">OpenRouter (Free Open Models)</option>
                  <option value="ollama">Ollama (100% Free Local AI • No Key Required)</option>
                  <option value="deterministic">Built-in Autonomous Engine (Zero Config)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Model</label>
                <input
                  type="text"
                  value={settings.ai_model || 'gemini-2.5-flash'}
                  onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                  placeholder="e.g. gemini-2.5-flash"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {settings.ai_provider !== 'ollama' && settings.ai_provider !== 'deterministic' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-zinc-300">
                    API Key for {(settings.ai_provider || 'gemini').toUpperCase()}
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {settings.has_custom_api_key === 'true' ? 'Key currently configured on server' : 'Using environment fallback'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter server API key..."
                    className="w-full pl-3 pr-24 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
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
                  Encrypted at rest and strictly processed in backend server execution.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleTestAIConnection}
                disabled={testingAI}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700 transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{testingAI ? 'Testing Connection...' : 'Test AI Connection'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md shadow-indigo-500/15"
              >
                Save AI Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. COMPLIANCE & LEGAL TAB */}
      {activeTab === 'compliance' && (
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Legal Compliance & Governance
                </h3>
                <p className="text-xs text-zinc-400">
                  Terms of service agreement, audit records, and workspace lifecycle.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-white">Terms of Service</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Version 2026.1 accepted upon registration. Governs multi-store data ownership and acceptable use.
                </p>
              </div>
              <Link
                to="/terms"
                target="_blank"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700 transition-colors shrink-0 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Terms & Conditions</span>
              </Link>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Demonstration Sample Catalog</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Populate demo catalog products and sample transactions into this demo account.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSeedDemoData}
                disabled={seeding}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 transition-colors shrink-0 cursor-pointer"
              >
                {seeding ? 'Seeding...' : 'Load Sample Catalog'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-rose-300">Clear Workspace Data</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Permanently purge all orders, products, and clients associated with your business account.
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
      )}

      {/* Add / Edit Store Modal */}
      <Modal
        isOpen={storeModalOpen}
        onClose={() => setStoreModalOpen(false)}
        title={editingStore ? 'Edit Store Branch' : 'Add New Store Branch'}
        subtitle="Configure physical store location and independent inventory stock records"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveStore} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Store / Branch Name *</label>
              <input
                type="text"
                required
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                placeholder="e.g. Indiranagar Retail Branch"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Branch Code</label>
              <input
                type="text"
                value={storeForm.code}
                onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                placeholder="e.g. BLR-02"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">City</label>
              <input
                type="text"
                value={storeForm.city}
                onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                placeholder="e.g. Bengaluru"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">State</label>
              <select
                value={storeForm.state}
                onChange={(e) => setStoreForm({ ...storeForm, state: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">PIN Code (6 digits)</label>
              <input
                type="text"
                maxLength={6}
                value={storeForm.pincode}
                onChange={(e) => setStoreForm({ ...storeForm, pincode: e.target.value.replace(/\D/g, '') })}
                placeholder="560038"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Physical Street Address</label>
            <input
              type="text"
              value={storeForm.address}
              onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
              placeholder="e.g. 100 Feet Road, HAL 2nd Stage, Indiranagar"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Phone (+91)</label>
              <input
                type="tel"
                value={storeForm.phone}
                onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Store Email</label>
              <input
                type="email"
                value={storeForm.email}
                onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                placeholder="indiranagar@apex-enterprises.in"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={storeForm.is_primary}
              onChange={(e) => setStoreForm({ ...storeForm, is_primary: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_primary" className="text-xs text-zinc-300 font-medium">
              Designate as Primary Flagship Store
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setStoreModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              {editingStore ? 'Update Store' : 'Create Store'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
