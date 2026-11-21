'use client'
import Link from 'next/link'
import { ShoppingBag, Sun, Moon, Monitor, ShoppingCart, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore, useCartStore, useThemeStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { cart } = useCartStore()
  const { theme, setTheme } = useThemeStore()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    router.push('/')
  }

  const themeIcons = { light: <Sun size={18} />, dark: <Moon size={18} />, system: <Monitor size={18} /> }
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
            <ShoppingBag size={24} />
            CloudMart
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/products" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
              Products
            </Link>
            {isAuthenticated && (
              <Link href="/account/orders" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                My Orders
              </Link>
            )}
            {user?.is_staff && (
              <Link href="/admin" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(nextTheme)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              title={`Switch to ${nextTheme} mode`}
            >
              {themeIcons[theme]}
            </button>

            {/* Cart */}
            {isAuthenticated && (
              <Link href="/cart" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                <ShoppingCart size={20} />
                {cart && cart.item_count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {cart.item_count}
                  </span>
                )}
              </Link>
            )}

            {/* Auth */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/account" className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                  <User size={16} />
                  <span className="max-w-[120px] truncate">{user?.first_name || user?.email}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login" className="btn-secondary text-sm py-1.5 px-3">Login</Link>
                <Link href="/register" className="btn-primary text-sm py-1.5 px-3">Sign Up</Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <Link href="/products" className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>Products</Link>
            {isAuthenticated && (
              <>
                <Link href="/account/orders" className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>My Orders</Link>
                <Link href="/cart" className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>Cart</Link>
                {user?.is_staff && <Link href="/admin" className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>Admin Panel</Link>}
                <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="w-full text-left px-2 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Logout</button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link href="/login" className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/register" className="block px-2 py-2 rounded-lg bg-blue-600 text-white text-center" onClick={() => setMenuOpen(false)}>Sign Up</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
