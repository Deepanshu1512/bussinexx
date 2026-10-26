import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronDown,
  CircleHelp, ClipboardList, Clock3, Download, Ellipsis, LayoutDashboard, Menu,
  Package, Plus, Search, Settings2, SlidersHorizontal, Sparkles, TrendingUp,
  X, Pencil, Trash2, RefreshCw, Minus, Plus as PlusIcon, Wifi, WifiOff
} from 'lucide-react'
import './styles.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(x => x.msg).join(', ') : `Request failed (${response.status})`)
  }
  return body
}

const emptyForm = { name: '', sku: '', price: '', stock_quantity: '0', is_active: true }

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await api('/products/')
      setProducts(Array.isArray(data) ? data : [])
      setConnected(true)
      setError('')
    } catch (e) {
      setConnected(false)
      setError(e.message || 'Could not reach the API')
    } finally { setLoading(false) }
  }
  useEffect(() => { loadProducts() }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }, [toast])

  const filtered = useMemo(() => products.filter(p => {
    const q = query.toLowerCase().trim()
    const matchesQuery = !q || [p.name, p.sku, String(p.id)].some(v => String(v ?? '').toLowerCase().includes(q))
    const matchesFilter = filter === 'all' || (filter === 'active' && p.is_active) || (filter === 'low' && Number(p.stock_quantity) <= 5) || (filter === 'inactive' && !p.is_active)
    return matchesQuery && matchesFilter
  }), [products, query, filter])

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    low: products.filter(p => Number(p.stock_quantity) <= 5).length,
    value: products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock_quantity || 0), 0),
    units: products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0),
  }), [products])

  function openCreate() { setForm(emptyForm); setModal({ type: 'create' }) }
  function openEdit(p) { setForm({ name: p.name, sku: p.sku, price: String(p.price), stock_quantity: String(p.stock_quantity), is_active: p.is_active }); setModal({ type: 'edit', product: p }) }
  function updateForm(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function saveProduct(e) {
    e.preventDefault(); setSaving(true)
    const payload = { name: form.name.trim(), sku: form.sku.trim(), price: Number(form.price), stock_quantity: Number(form.stock_quantity), is_active: Boolean(form.is_active) }
    try {
      if (modal.type === 'create') await api('/products/', { method: 'POST', body: JSON.stringify(payload) })
      else await api(`/products/${modal.product.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      setModal(null); setToast(modal.type === 'create' ? 'Product added successfully' : 'Product changes saved'); await loadProducts()
    } catch (e) { setToast(e.message || 'Could not save product') }
    finally { setSaving(false) }
  }

  async function deleteProduct(p) {
    if (!window.confirm(`Delete “${p.name}” from your inventory? This cannot be undone.`)) return
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); setToast('Product deleted'); await loadProducts() }
    catch (e) { setToast(e.message || 'Could not delete product') }
  }

  async function changeStock(p, delta) {
    if (Number(p.stock_quantity) + delta < 0) { setToast('Stock cannot go below zero'); return }
    try { await api(`/products/${p.id}/stock?quantity=${delta}`, { method: 'PATCH' }); setToast(delta > 0 ? 'Stock increased' : 'Stock reduced'); await loadProducts() }
    catch (e) { setToast(e.message || 'Could not update stock') }
  }

  function exportCsv() {
    const rows = [['ID', 'Product', 'SKU', 'Price (INR)', 'Stock', 'Status'], ...filtered.map(p => [p.id, p.name, p.sku, p.price, p.stock_quantity, p.is_active ? 'Active' : 'Inactive'])]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'bussinex-inventory.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Boxes size={21}/></div><div><strong>bussinex<span>.</span></strong><small>INVENTORY SUITE</small></div><button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">
        <button className="nav-item"><LayoutDashboard size={18}/> Overview</button>
        <button className="nav-item active"><Package size={18}/> Products <span className="nav-count">{products.length}</span></button>
        <button className="nav-item" onClick={() => { setFilter('low'); setSidebarOpen(false) }}><AlertTriangle size={18}/> Low stock {stats.low > 0 && <span className="nav-alert">{stats.low}</span>}</button>
        <button className="nav-item" onClick={exportCsv}><ClipboardList size={18}/> Reports</button>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Keep your inventory in shape.</p><button onClick={() => setToast('Tip: use the stock controls to adjust quantities quickly.')}>Quick tips <ArrowUpRight size={14}/></button></div><div className="profile"><div className="avatar">BX</div><div className="profile-copy"><strong>Workspace admin</strong><small>Local workspace</small></div><Ellipsis size={18} className="muted-icon"/></div></div>
    </aside>
    {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu"/>}

    <main className="main-content">
      <header className="topbar"><div className="crumbs"><button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><span>Workspace</span><span className="crumb-sep">/</span><strong>Products</strong></div><div className="topbar-right"><div className={`connection ${connected ? 'online' : 'offline'}`}>{connected ? <Wifi size={14}/> : <WifiOff size={14}/>}<span>{connected ? 'API connected' : 'API disconnected'}</span></div><div className="top-divider"/><button className="icon-btn" title="Refresh products" onClick={loadProducts}><RefreshCw size={17}/></button><div className="avatar avatar-small">D</div></div></header>

      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> INVENTORY MANAGEMENT</div><h1>Product inventory</h1><p className="subtitle">A clear view of what you have, what you need, and what’s moving.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button><button className="btn btn-primary" onClick={openCreate}><Plus size={17}/> Add product</button></div></section>

      {error && <div className="error-banner"><AlertTriangle size={18}/><div><strong>Can’t connect to the backend</strong><p>{error}. Make sure FastAPI is running at <code>{API_BASE}</code> and refresh.</p></div><button className="btn btn-secondary btn-compact" onClick={loadProducts}><RefreshCw size={14}/> Retry</button></div>}

      <section className="stats-grid">
        <StatCard label="Total products" value={stats.total.toLocaleString('en-IN')} icon={<Package size={19}/>} tone="violet" note="Across your catalogue" />
        <StatCard label="Inventory value" value={money(stats.value)} icon={<TrendingUp size={19}/>} tone="mint" note={`${stats.units.toLocaleString('en-IN')} units in stock`} />
        <StatCard label="Active products" value={stats.active.toLocaleString('en-IN')} icon={<Activity size={19}/>} tone="blue" note={`${stats.total ? Math.round(stats.active / stats.total * 100) : 0}% of catalogue`} />
        <StatCard label="Low stock alerts" value={stats.low.toLocaleString('en-IN')} icon={<AlertTriangle size={19}/>} tone="amber" note="5 units or fewer" warning={stats.low > 0}/>
      </section>

      <section className="inventory-panel"><div className="panel-heading"><div><h2>All products <span className="count-pill">{filtered.length}</span></h2><p>Manage product details and stock levels.</p></div><button className="icon-btn panel-more" title="Refresh" onClick={loadProducts}><RefreshCw size={16}/></button></div>
        <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, SKU or ID..."/><kbd>⌘ K</kbd></label><div className="toolbar-right"><label className="filter-select"><SlidersHorizontal size={15}/><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All products</option><option value="active">Active only</option><option value="low">Low stock</option><option value="inactive">Inactive only</option></select><ChevronDown size={14}/></label><button className="btn btn-secondary btn-filter" onClick={() => { setQuery(''); setFilter('all') }}><Settings2 size={15}/> Reset</button></div></div>
        <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select all products" disabled/></th><th>PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK LEVEL</th><th>STATUS</th><th className="actions-head">ACTIONS</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="7"><div className="table-state"><span className="spinner"/>Loading your inventory...</div></td></tr> : filtered.length === 0 ? <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon"><Package size={24}/></div><strong>{error ? 'Waiting for your backend' : query || filter !== 'all' ? 'No matching products' : 'Your inventory starts here'}</strong><p>{error ? 'Once the API is available, your products will show up here.' : query || filter !== 'all' ? 'Try another search or reset the filters.' : 'Add your first product to start tracking stock.'}</p>{!error && !query && filter === 'all' && <button className="btn btn-primary" onClick={openCreate}><Plus size={16}/> Add first product</button>}</div></td></tr> : filtered.map(p => <tr key={p.id}><td><input type="checkbox" aria-label={`Select ${p.name}`} disabled/></td><td><div className="product-cell"><div className={`product-thumb thumb-${(p.id % 5) + 1}`}><Package size={19}/></div><div className="product-info"><strong>{p.name}</strong><small>Product ID: #{String(p.id).padStart(4, '0')}</small></div></div></td><td><span className="sku">{p.sku}</span></td><td><strong className="price">{money(p.price)}</strong></td><td><div className="stock-cell"><div className="stock-number"><strong>{p.stock_quantity}</strong><span>units</span></div><div className="stock-track"><span className={Number(p.stock_quantity) <= 5 ? 'stock-low' : Number(p.stock_quantity) <= 15 ? 'stock-mid' : 'stock-good'} style={{ width: `${Math.max(4, Math.min(100, Number(p.stock_quantity) * 2))}%` }}/></div>{Number(p.stock_quantity) <= 5 && <small className="low-label"><AlertTriangle size={11}/> Low</small>}</div></td><td><span className={`status ${p.is_active ? 'status-active' : 'status-inactive'}`}><i/>{p.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="row-actions"><button className="action-btn" title="Decrease stock by one" onClick={() => changeStock(p, -1)} disabled={Number(p.stock_quantity) <= 0}><Minus size={15}/></button><button className="action-btn" title="Increase stock by one" onClick={() => changeStock(p, 1)}><PlusIcon size={15}/></button><span className="action-divider"/><button className="action-btn" title="Edit product" onClick={() => openEdit(p)}><Pencil size={15}/></button><button className="action-btn action-danger" title="Delete product" onClick={() => deleteProduct(p)}><Trash2 size={15}/></button></div></td></tr>)}
        </tbody></table></div>
        <div className="table-footer"><span>Showing <strong>{filtered.length ? 1 : 0}–{filtered.length}</strong> of <strong>{products.length}</strong> products</span><span className="footer-live"><span/> Live inventory data</span></div>
      </section>
      <footer className="page-footer"><span>© 2026 Bussinex. Built for better business.</span><span><span className="footer-status-dot"/> {connected ? 'All systems operational' : 'Waiting for API'} <span className="footer-separator">·</span> v0.1.0</span></footer>
    </main>

    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="modal-icon"><Package size={19}/></div><h2 id="modal-title">{modal.type === 'create' ? 'Add a product' : 'Edit product'}</h2><p>{modal.type === 'create' ? 'Add a new item to your inventory.' : `Update details for ${modal.product.name}.`}</p></div><button className="icon-btn" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19}/></button></div><form onSubmit={saveProduct}><label className="form-field"><span>Product name <b>*</b></span><input autoFocus required maxLength="150" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="e.g. Wireless headphones"/></label><label className="form-field"><span>SKU <b>*</b></span><input required maxLength="100" value={form.sku} onChange={e => updateForm('sku', e.target.value)} placeholder="e.g. AUD-001"/><small>Each product must have a unique SKU.</small></label><div className="form-row"><label className="form-field"><span>Price (INR) <b>*</b></span><div className="input-prefix"><span>₹</span><input type="number" min="0" step="0.01" required value={form.price} onChange={e => updateForm('price', e.target.value)} placeholder="0.00"/></div></label><label className="form-field"><span>Stock quantity</span><input type="number" min="0" step="1" required value={form.stock_quantity} onChange={e => updateForm('stock_quantity', e.target.value)} placeholder="0"/></label></div><label className="toggle-row"><span><strong>Product is active</strong><small>Inactive products remain in your catalogue.</small></span><input type="checkbox" checked={form.is_active} onChange={e => updateForm('is_active', e.target.checked)}/></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="button-spinner"/> Saving...</> : <><Check size={16}/>{modal.type === 'create' ? 'Create product' : 'Save changes'}</>}</button></div></form></section></div>}
    {toast && <div className="toast"><div className="toast-check"><Check size={15}/></div><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </div>
}

function StatCard({ label, value, icon, tone, note, warning }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{warning ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}<span>{note}</span></div></article>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
