'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Menu, X } from 'lucide-react'
import { useAuthStore, useCartStore, useThemeStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Category, PaginatedResponse } from '@/types'
import { toast } from 'sonner'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { cart } = useCartStore()
  const { theme, setTheme } = useThemeStore()
  const router = useRouter()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkDark = () => {
      if (theme === 'dark') return true
      if (theme === 'light') return false
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    setIsDark(checkDark())
  }, [theme])

  // Fetch categories for the sub-navigation bar
  const { data: categoriesData } = useQuery<PaginatedResponse<Category>>({
    queryKey: ['navbar-categories'],
    queryFn: () => api.get('/categories/').then((res) => res.data),
    staleTime: 60000,
  })

  const categories = categoriesData?.results || []
  const cartCount = cart?.item_count || 0

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out successfully')
    router.replace('/welcome')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchTerm.trim()
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`)
    } else {
      router.push('/products')
    }
    setMenuOpen(false)
  }

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--cm-surface)] border-b border-[var(--cm-line)]">
      {/* Main Bar */}
      <div className="cm-container-full py-3 flex flex-wrap lg:flex-nowrap items-center gap-3 lg:gap-5">
        {/* Brand Wordmark */}
        <Link
          href="/"
          className="text-[1.5rem] sm:text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)] shrink-0 no-underline hover:no-underline"
        >
          Cloud<span className="text-[var(--cm-link)]">Mart</span>
        </Link>

        {/* Search Form */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="flex flex-1 order-3 lg:order-none basis-full lg:basis-auto min-w-0"
        >
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search electronics and accessories"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-w-0 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-[var(--cm-surface)] text-[var(--cm-ink)] border border-[var(--cm-line)] rounded-l-lg text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-[var(--cm-blue)] text-white font-semibold text-sm rounded-r-lg shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Laptop & Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-4 shrink-0 text-sm font-semibold whitespace-nowrap">
          <Link href="/products" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
            Products
          </Link>
          {isAuthenticated ? (
            <>
              <Link href="/account/orders" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
                My orders
              </Link>
              <Link href="/cart" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
                Cart ({cartCount})
              </Link>
              <Link href="/account" className="text-[var(--cm-link)] max-w-[110px] truncate">
                {user?.first_name || user?.email}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary text-xs py-2 px-3"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
                Sign in
              </Link>
              <Link href="/cart" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
                Cart ({cartCount})
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary text-sm py-2 px-3.5"
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </nav>

        {/* Mobile & Tablet Controls */}
        <div className="flex lg:hidden items-center gap-2 ml-auto shrink-0">
          <Link href="/cart" className="text-xs sm:text-sm font-semibold text-[var(--cm-ink)] px-2 py-1.5 whitespace-nowrap">
            Cart ({cartCount})
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary text-xs py-1.5 px-2.5"
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-[var(--cm-ink)] hover:bg-[var(--cm-tint)]"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Category Sub-Bar */}
      <nav
        aria-label="Product categories"
        className="cm-container-full pt-1 pb-2.5 flex items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap text-xs sm:text-sm font-semibold"
      >
        <Link href="/products" className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]">
          All categories
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.id}`}
            className="text-[var(--cm-ink)] hover:text-[var(--cm-link)]"
          >
            {cat.name}
          </Link>
        ))}
      </nav>

      {/* Mobile & Tablet Dropdown */}
      {menuOpen && (
        <div className="lg:hidden border-t border-[var(--cm-line)] bg-[var(--cm-surface)] px-4 py-3 space-y-2 text-sm font-semibold">
          <Link href="/products" className="block py-1.5 text-[var(--cm-ink)]" onClick={() => setMenuOpen(false)}>
            Products
          </Link>
          {isAuthenticated ? (
            <>
              <Link href="/account/orders" className="block py-1.5 text-[var(--cm-ink)]" onClick={() => setMenuOpen(false)}>
                My orders
              </Link>
              <Link href="/account" className="block py-1.5 text-[var(--cm-ink)]" onClick={() => setMenuOpen(false)}>
                Account
              </Link>
              <button
                type="button"
                onClick={() => {
                  handleLogout()
                  setMenuOpen(false)
                }}
                className="block w-full text-left py-1.5 text-red-500"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block py-1.5 text-[var(--cm-ink)]" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link href="/register" className="block py-1.5 text-[var(--cm-link)]" onClick={() => setMenuOpen(false)}>
                Create account
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
