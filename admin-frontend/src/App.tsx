import { useState, useEffect, FormEvent } from 'react'
import { api, ACCESS_KEY, REFRESH_KEY, formatINR, getImageUrl } from './api'

type Tab = 'overview' | 'products' | 'add-product' | 'categories' | 'inventory' | 'orders' | 'payments' | 'customers'

interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  is_staff: boolean
  is_superuser?: boolean
}

interface Category {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
}

interface Product {
  id: number
  name: string
  slug: string
  description: string
  category: number
  category_name: string
  is_active: boolean
  min_price: number | null
  primary_image?: { id: number; image: string } | null
  images?: { id: number; image: string }[]
  variants: {
    id: number
    sku: string
    price_paise: number
    original_price_paise: number | null
    stock_quantity: number
    inventory?: { quantity: number; reserved_quantity: number; available_quantity: number; is_low_stock: boolean }
  }[]
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('cm_admin_dark') === 'true')
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)

  // Data states
  const [dashboard, setDashboard] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')

  // Add Product form
  const [pName, setPName] = useState('')
  const [pCategoryId, setPCategoryId] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [pSku, setPSku] = useState('')
  const [pPriceInr, setPPriceInr] = useState('')
  const [pMrpInr, setPMrpInr] = useState('')
  const [pStock, setPStock] = useState('10')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)

  // Add Category form
  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('cm_admin_dark', String(dark))
  }, [dark])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_KEY)
    if (!token) {
      setCheckingAuth(false)
      return
    }
    api
      .get('/auth/me/')
      .then((res) => {
        if (res.data?.is_staff || res.data?.is_superuser) {
          setUser(res.data)
        } else {
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
        }
      })
      .catch(() => {
        localStorage.removeItem(ACCESS_KEY)
        localStorage.removeItem(REFRESH_KEY)
      })
      .finally(() => setCheckingAuth(false))
  }, [])

  const loadAllData = async () => {
    try {
      const [dashRes, prodRes, catRes, ordRes, payRes, custRes] = await Promise.all([
        api.get('/admin/dashboard/').catch(() => null),
        api.get('/admin/products/').catch(() => null),
        api.get('/admin/categories/').catch(() => null),
        api.get('/admin/orders/').catch(() => null),
        api.get('/admin/payments/').catch(() => null),
        api.get('/admin/customers/').catch(() => null),
      ])
      if (dashRes?.data?.data) setDashboard(dashRes.data.data)
      if (prodRes?.data?.results) setProducts(prodRes.data.results)
      if (catRes?.data?.results) {
        setCategories(catRes.data.results)
        if (!pCategoryId && catRes.data.results.length > 0) {
          setPCategoryId(String(catRes.data.results[0].id))
        }
      }
      if (ordRes?.data?.results) setOrders(ordRes.data.results)
      if (payRes?.data?.results) setPayments(payRes.data.results)
      if (custRes?.data?.results) setCustomers(custRes.data.results)
    } catch {
      // handled per endpoint
    }
  }

  useEffect(() => {
    if (user) loadAllData()
  }, [user])

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 5000)
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setAuthBusy(true)
    setNotice(null)
    try {
      const { data } = await api.post('/auth/login/', { email: email.trim(), password })
      if (!data.user?.is_staff && !data.user?.is_superuser) {
        showMsg('err', 'Access denied. Admin privileges required.')
        setAuthBusy(false)
        return
      }
      localStorage.setItem(ACCESS_KEY, data.access)
      localStorage.setItem(REFRESH_KEY, data.refresh)
      setUser(data.user)
    } catch (err: any) {
      showMsg('err', err.response?.data?.detail || 'Invalid admin email or password.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setUser(null)
  }

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault()
    if (!pName.trim() || !pCategoryId || !pSku.trim() || !pPriceInr) {
      return showMsg('err', 'Please fill product name, category, SKU, and price.')
    }
    setSavingProduct(true)
    try {
      const pricePaise = Math.round(Number(pPriceInr) * 100)
      const mrpPaise = pMrpInr ? Math.round(Number(pMrpInr) * 100) : null
      const res = await api.post('/admin/products/', {
        name: pName.trim(),
        category_id: Number(pCategoryId),
        description: pDesc.trim(),
        is_active: true,
        variants: [
          {
            sku: pSku.trim(),
            price_paise: pricePaise,
            original_price_paise: mrpPaise,
            stock_quantity: Number(pStock || 0),
            is_active: true,
          },
        ],
      })
      const createdId = res.data?.data?.id
      if (createdId && pImageFile) {
        try {
          const fd = new FormData()
          fd.append('images', pImageFile)
          fd.append('alt_text', pName.trim())
          await api.post(`/admin/products/${createdId}/images/`, fd)
          showMsg('ok', `Product "${pName}" and image saved successfully!`)
        } catch (imgErr: any) {
          showMsg('err', `Product "${pName}" was created, but image upload failed: ${imgErr.response?.data?.message || 'Upload error'}`)
        }
      } else {
        showMsg('ok', `Product "${pName}" created successfully!`)
      }
      setPName('')
      setPDesc('')
      setPSku('')
      setPPriceInr('')
      setPMrpInr('')
      setPStock('10')
      setPImageFile(null)
      await loadAllData()
      setTab('products')
    } catch (err: any) {
      const d = err.response?.data
      const skuErr = d?.variants?.[0]?.sku?.[0]
      if (skuErr) {
        showMsg('err', `SKU "${pSku.trim()}": ${skuErr} Please enter a unique SKU.`)
      } else {
        showMsg('err', typeof d === 'string' ? d : d?.detail || d?.message || JSON.stringify(d) || 'Failed to create product.')
      }
    } finally {
      setSavingProduct(false)
    }
  }

  const handleUploadImage = async (productId: number, file: File) => {
    const fd = new FormData()
    fd.append('images', file)
    try {
      await api.post(`/admin/products/${productId}/images/`, fd)
      showMsg('ok', 'Product image uploaded!')
      await loadAllData()
    } catch (err: any) {
      showMsg('err', err.response?.data?.message || 'Failed to upload image.')
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Delete or deactivate "${product.name}"?`)) return
    try {
      const res = await api.delete(`/admin/products/${product.id}/`)
      showMsg('ok', res.data?.message || 'Product removed.')
      await loadAllData()
    } catch {
      showMsg('err', 'Failed to delete product.')
    }
  }

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!cName.trim()) return
    setSavingCat(true)
    try {
      await api.post('/admin/categories/', { name: cName.trim(), description: cDesc.trim(), is_active: true })
      showMsg('ok', `Category "${cName}" added!`)
      setCName('')
      setCDesc('')
      await loadAllData()
    } catch (err: any) {
      showMsg('err', err.response?.data?.detail || 'Failed to create category.')
    } finally {
      setSavingCat(false)
    }
  }

  const handleToggleCategory = async (cat: Category) => {
    try {
      await api.patch(`/admin/categories/${cat.id}/`, { is_active: !cat.is_active })
      await loadAllData()
    } catch {
      showMsg('err', 'Failed to update category.')
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Delete or deactivate category "${cat.name}"?`)) return
    try {
      const res = await api.delete(`/admin/categories/${cat.id}/`)
      showMsg('ok', res.data?.message || 'Category updated.')
      await loadAllData()
    } catch {
      showMsg('err', 'Failed to delete category.')
    }
  }

  const handleAdjustStock = async (variantId: number, currentQty: number, delta: number) => {
    const newQty = Math.max(0, currentQty + delta)
    try {
      await api.patch(`/admin/inventory/${variantId}/adjust/`, {
        quantity: newQty,
        notes: 'Adjusted via CloudMart Admin Portal',
      })
      showMsg('ok', `Stock updated to ${newQty}.`)
      await loadAllData()
    } catch (err: any) {
      showMsg('err', err.response?.data?.detail || err.response?.data?.message || 'Stock adjustment failed.')
    }
  }

  const handleOrderStatus = async (orderId: number, statusVal: string) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status/`, { status: statusVal })
      showMsg('ok', `Order status updated to ${statusVal}.`)
      await loadAllData()
    } catch (err: any) {
      showMsg('err', err.response?.data?.detail || 'Failed to update order status.')
    }
  }

  const handleCollectCOD = async (paymentId: string) => {
    try {
      await api.post(`/admin/payments/${paymentId}/collect/`)
      showMsg('ok', 'COD payment marked as collected.')
      await loadAllData()
    } catch {
      showMsg('err', 'Failed to collect COD.')
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-sm text-[var(--cm-muted)]">Loading CloudMart Admin…</p>
      </div>
    )
  }

  // ── Login Screen ──
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-4 py-8">
        <form
          onSubmit={handleLogin}
          className="panel w-full max-w-[410px] p-6 sm:p-[34px] shadow-[0_12px_45px_rgba(19,34,66,0.08)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)]">
              Cloud<span className="text-[var(--cm-link)]">Mart</span>
            </span>
            <button type="button" onClick={() => setDark(!dark)} className="btn-secondary text-xs py-1.5 px-3">
              {dark ? 'Light' : 'Dark'}
            </button>
          </div>
          <h1 className="text-[1.85rem] font-bold tracking-[-0.035em] mb-1">Admin Sign in</h1>
          <p className="text-sm text-[var(--cm-muted)] mb-5">Sign in with your CloudMart administrator account.</p>

          {notice && (
            <p role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium">
              {notice.text}
            </p>
          )}

          <label className="grid gap-1.5 font-semibold text-sm my-3">
            <span>Admin Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cloudmart.local"
              className="input-field text-sm"
            />
          </label>

          <label className="grid gap-1.5 font-semibold text-sm my-3">
            <span>Password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field text-sm"
            />
          </label>

          <label className="flex items-center gap-2.5 font-semibold text-sm my-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="w-4 h-4 accent-[var(--cm-blue)] rounded"
            />
            <span>Show password</span>
          </label>

          <button type="submit" disabled={authBusy} className="btn-primary w-full py-2.5 text-sm mt-2">
            {authBusy ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>
      </div>
    )
  }

  const navItems: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Products' },
    { id: 'add-product', label: '+ Add product' },
    { id: 'categories', label: 'Categories' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'customers', label: 'Customers' },
  ]

  const filteredProducts = products.filter((p) =>
    (p.name + ' ' + p.category_name + ' ' + p.variants.map((v) => v.sku).join(' '))
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Full-width Header */}
      <header className="sticky top-0 z-40 bg-[var(--cm-surface)] border-b border-[var(--cm-line)] px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[1.5rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)]">
            Cloud<span className="text-[var(--cm-link)]">Mart</span>
          </span>
          <span className="badge">Admin Portal</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-[var(--cm-muted)]">{user.email}</span>
          <button type="button" onClick={() => setDark(!dark)} className="btn-secondary text-xs py-1.5 px-3">
            {dark ? 'Light' : 'Dark'}
          </button>
          <button type="button" onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="flex-1 w-full px-4 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-5 items-start">
        {/* Sidebar */}
        <aside className="card p-3 flex md:grid flex-wrap gap-1.5 md:sticky md:top-20">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-[var(--cm-tint)] text-[var(--cm-link)]'
                  : 'text-[var(--cm-ink)] hover:bg-[var(--cm-tint)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="min-w-0 space-y-5">
          {notice && (
            <div
              className={`panel py-3 px-4 flex items-center justify-between text-sm font-semibold ${
                notice.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'
              }`}
            >
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} className="btn-secondary text-xs py-1 px-2.5">
                Dismiss
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Store overview</h1>
              {dashboard ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <article className="panel">
                      <small className="text-xs text-[var(--cm-muted)]">Orders</small>
                      <h2 className="text-2xl font-bold mt-1">{dashboard.orders.total}</h2>
                      <small className="text-xs text-[var(--cm-muted)]">
                        {dashboard.orders.pending} pending · {dashboard.orders.delivered} delivered
                      </small>
                    </article>
                    <article className="panel">
                      <small className="text-xs text-[var(--cm-muted)]">Collected revenue</small>
                      <h2 className="text-2xl font-bold mt-1">{formatINR(dashboard.revenue.collected_paise)}</h2>
                      <small className="text-xs text-[var(--cm-muted)]">
                        {formatINR(dashboard.revenue.pending_paise)} pending
                      </small>
                    </article>
                    <article className="panel">
                      <small className="text-xs text-[var(--cm-muted)]">Catalog & Stock</small>
                      <h2 className="text-2xl font-bold mt-1">{dashboard.products.total} products</h2>
                      <small className="text-xs text-[var(--cm-muted)]">
                        {dashboard.products.active} active · {dashboard.products.low_stock} low stock
                      </small>
                    </article>
                  </div>

                  <section className="panel space-y-3">
                    <h2 className="text-lg font-bold">Recent orders</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                            <th className="py-2 px-2">Order</th>
                            <th className="py-2 px-2">Customer</th>
                            <th className="py-2 px-2">Amount</th>
                            <th className="py-2 px-2">Payment</th>
                            <th className="py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dashboard.recent_orders || []).map((o: any) => (
                            <tr key={o.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                              <td className="py-2.5 px-2 font-mono text-xs">{o.order_number}</td>
                              <td className="py-2.5 px-2">{o.customer_name || o.customer_email}</td>
                              <td className="py-2.5 px-2 font-semibold">{formatINR(o.total_paise)}</td>
                              <td className="py-2.5 px-2"><span className="badge">{o.payment_method}</span></td>
                              <td className="py-2.5 px-2"><span className="badge">{o.status}</span></td>
                            </tr>
                          ))}
                          {(!dashboard.recent_orders || dashboard.recent_orders.length === 0) && (
                            <tr><td colSpan={5} className="py-4 text-[var(--cm-muted)]">No orders yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <p className="text-sm text-[var(--cm-muted)]">Loading dashboard metrics…</p>
              )}
            </div>
          )}

          {/* PRODUCTS */}
          {tab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-[-0.035em]">Products ({products.length})</h1>
                <button type="button" onClick={() => setTab('add-product')} className="btn-primary text-sm">
                  + Add product
                </button>
              </div>
              <input
                type="search"
                placeholder="Search by product name, category, or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field text-sm max-w-md"
              />
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Product</th>
                      <th className="py-2.5 px-2">Category</th>
                      <th className="py-2.5 px-2">SKU</th>
                      <th className="py-2.5 px-2">Price</th>
                      <th className="py-2.5 px-2">Stock</th>
                      <th className="py-2.5 px-2">Upload Image</th>
                      <th className="py-2.5 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const img = p.primary_image?.image || p.images?.[0]?.image
                      const totalStock = p.variants.reduce((s, v) => s + (v.inventory?.available_quantity ?? v.stock_quantity ?? 0), 0)
                      return (
                        <tr key={p.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              {img ? (
                                <img src={getImageUrl(img)} alt={p.name} className="w-10 h-10 rounded-lg object-contain bg-white border border-[var(--cm-line)]" />
                              ) : (
                                <span className="w-10 h-10 rounded-lg bg-[var(--cm-tint)] grid place-items-center text-[10px] text-[var(--cm-muted)]">No img</span>
                              )}
                              <div>
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-xs text-[var(--cm-muted)]">{p.is_active ? 'Active' : 'Inactive'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">{p.category_name}</td>
                          <td className="py-3 px-2 font-mono text-xs">{p.variants[0]?.sku || '—'}</td>
                          <td className="py-3 px-2 font-semibold">{p.min_price ? formatINR(p.min_price) : '—'}</td>
                          <td className="py-3 px-2">{totalStock}</td>
                          <td className="py-3 px-2">
                            <label className="btn-secondary text-xs py-1 px-2.5 cursor-pointer">
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleUploadImage(p.id, f)
                                }}
                              />
                            </label>
                          </td>
                          <td className="py-3 px-2">
                            <button type="button" onClick={() => handleDeleteProduct(p)} className="text-xs text-red-500 hover:underline cursor-pointer">
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ADD PRODUCT */}
          {tab === 'add-product' && (
            <form onSubmit={handleCreateProduct} className="panel max-w-2xl space-y-4">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Add product</h1>

              <label className="grid gap-1.5 text-sm font-semibold">
                <span>Product name</span>
                <input required value={pName} onChange={(e) => setPName(e.target.value)} className="input-field text-sm" placeholder="e.g. Mechanical Gaming Keyboard" />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold">
                <span>Category</span>
                <select required value={pCategoryId} onChange={(e) => setPCategoryId(e.target.value)} className="input-field text-sm">
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold">
                <span>Description</span>
                <textarea rows={3} value={pDesc} onChange={(e) => setPDesc(e.target.value)} className="input-field text-sm" placeholder="Product features and details…" />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span>SKU</span>
                  <input required value={pSku} onChange={(e) => setPSku(e.target.value)} className="input-field text-sm" placeholder="CM-KEY-001" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span>Initial stock</span>
                  <input type="number" min="0" required value={pStock} onChange={(e) => setPStock(e.target.value)} className="input-field text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span>Selling price (₹)</span>
                  <input type="number" step="0.01" min="1" required value={pPriceInr} onChange={(e) => setPPriceInr(e.target.value)} className="input-field text-sm" placeholder="1999" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span>Original MRP (₹, optional)</span>
                  <input type="number" step="0.01" min="1" value={pMrpInr} onChange={(e) => setPMrpInr(e.target.value)} className="input-field text-sm" placeholder="2999" />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-semibold">
                <span>Product image (optional)</span>
                <input type="file" accept="image/*" onChange={(e) => setPImageFile(e.target.files?.[0] || null)} className="input-field text-sm" />
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingProduct} className="btn-primary text-sm">
                  {savingProduct ? 'Saving…' : 'Save product'}
                </button>
                <button type="button" onClick={() => setTab('products')} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* CATEGORIES */}
          {tab === 'categories' && (
            <div className="space-y-5">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Categories ({categories.length})</h1>

              <form onSubmit={handleCreateCategory} className="panel max-w-xl space-y-3">
                <h2 className="text-lg font-bold">Add new category</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Category name" className="input-field text-sm" />
                  <input value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="Short description (optional)" className="input-field text-sm" />
                </div>
                <button type="submit" disabled={savingCat} className="btn-primary text-sm">
                  {savingCat ? 'Adding…' : '+ Add category'}
                </button>
              </form>

              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Name</th>
                      <th className="py-2.5 px-2">Slug</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                        <td className="py-3 px-2 font-semibold">{c.name}</td>
                        <td className="py-3 px-2 font-mono text-xs text-[var(--cm-muted)]">{c.slug}</td>
                        <td className="py-3 px-2">
                          <span className="badge">{c.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="py-3 px-2 flex gap-3">
                          <button type="button" onClick={() => handleToggleCategory(c)} className="text-xs text-[var(--cm-link)] hover:underline cursor-pointer">
                            {c.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => handleDeleteCategory(c)} className="text-xs text-red-500 hover:underline cursor-pointer">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === 'inventory' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Inventory</h1>
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Product</th>
                      <th className="py-2.5 px-2">SKU</th>
                      <th className="py-2.5 px-2">Available</th>
                      <th className="py-2.5 px-2">Adjust Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.flatMap((p) =>
                      p.variants.map((v) => {
                        const qty = v.inventory?.quantity ?? v.stock_quantity ?? 0
                        return (
                        <tr key={v.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                          <td className="py-3 px-2 font-semibold">{p.name}</td>
                          <td className="py-3 px-2 font-mono text-xs">{v.sku}</td>
                          <td className="py-3 px-2 font-bold">{v.inventory?.available_quantity ?? v.stock_quantity ?? 0}</td>
                          <td className="py-3 px-2 flex gap-2">
                            <button type="button" onClick={() => handleAdjustStock(v.id, qty, 5)} className="btn-secondary text-xs py-1 px-2.5">+5</button>
                            <button type="button" onClick={() => handleAdjustStock(v.id, qty, 1)} className="btn-secondary text-xs py-1 px-2.5">+1</button>
                            <button type="button" onClick={() => handleAdjustStock(v.id, qty, -1)} className="btn-secondary text-xs py-1 px-2.5">-1</button>
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Orders ({orders.length})</h1>
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Order</th>
                      <th className="py-2.5 px-2">Customer</th>
                      <th className="py-2.5 px-2">Total</th>
                      <th className="py-2.5 px-2">Payment</th>
                      <th className="py-2.5 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                        <td className="py-3 px-2 font-mono text-xs">{o.order_number}</td>
                        <td className="py-3 px-2">{o.customer_name || o.customer_email}</td>
                        <td className="py-3 px-2 font-semibold">{formatINR(o.total_paise)}</td>
                        <td className="py-3 px-2"><span className="badge">{o.payment_method} ({o.payment_status})</span></td>
                        <td className="py-3 px-2">
                          <select
                            value={o.status}
                            onChange={(e) => handleOrderStatus(o.id, e.target.value)}
                            className="input-field text-xs py-1 px-2 w-auto"
                          >
                            {['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-[var(--cm-muted)]">No orders found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Payments ({payments.length})</h1>
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Order</th>
                      <th className="py-2.5 px-2">Method</th>
                      <th className="py-2.5 px-2">Amount</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                        <td className="py-3 px-2 font-mono text-xs">{pay.order_number}</td>
                        <td className="py-3 px-2">{pay.payment_method}</td>
                        <td className="py-3 px-2 font-semibold">{formatINR(pay.amount_paise)}</td>
                        <td className="py-3 px-2"><span className="badge">{pay.status}</span></td>
                        <td className="py-3 px-2">
                          {pay.payment_method === 'COD' && pay.status === 'PENDING' && (
                            <button type="button" onClick={() => handleCollectCOD(pay.id)} className="btn-primary text-xs py-1 px-2.5">
                              Mark Collected
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-[var(--cm-muted)]">No payment records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CUSTOMERS */}
          {tab === 'customers' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-[-0.035em]">Customers ({customers.length})</h1>
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                      <th className="py-2.5 px-2">Name</th>
                      <th className="py-2.5 px-2">Email</th>
                      <th className="py-2.5 px-2">Phone</th>
                      <th className="py-2.5 px-2">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((cu) => (
                      <tr key={cu.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                        <td className="py-3 px-2 font-semibold">{cu.first_name || cu.username} {cu.last_name || ''}</td>
                        <td className="py-3 px-2">{cu.email}</td>
                        <td className="py-3 px-2">{cu.phone || '—'}</td>
                        <td className="py-3 px-2"><span className="badge">{cu.is_staff ? 'Admin' : 'Customer'}</span></td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-[var(--cm-muted)]">No customers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
