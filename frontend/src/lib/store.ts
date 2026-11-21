import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Cart } from '@/types'
import { api } from '@/lib/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (userData: any) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login/', { email, password })
          localStorage.setItem('access_token', data.access)
          localStorage.setItem('refresh_token', data.refresh)
          set({ user: data.user, isAuthenticated: true, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      register: async (userData: any) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register/', userData)
          if (data?.data?.tokens?.access) {
            localStorage.setItem('access_token', data.data.tokens.access)
            localStorage.setItem('refresh_token', data.data.tokens.refresh)
          }
          set({ user: data?.data?.user || null, isAuthenticated: true, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try {
          const refresh = localStorage.getItem('refresh_token')
          if (refresh) await api.post('/auth/logout/', { refresh })
        } catch {}
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false })
      },

      loadUser: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        if (!token) return
        try {
          const { data } = await api.get('/auth/me/')
          set({ user: data, isAuthenticated: true })
        } catch {
          set({ user: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'cloudmart-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

interface CartState {
  cart: Cart | null
  isLoading: boolean
  fetchCart: () => Promise<void>
  addItem: (variantId: number, quantity: number) => Promise<void>
  updateItem: (itemId: number, quantity: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  clearCart: () => Promise<void>
}

export const useCartStore = create<CartState>()((set) => ({
  cart: null,
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/cart/')
      set({ cart: data.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  addItem: async (variantId, quantity) => {
    const { data } = await api.post('/cart/items/', { variant_id: variantId, quantity })
    set({ cart: data.data })
  },

  updateItem: async (itemId, quantity) => {
    const { data } = await api.patch(`/cart/items/${itemId}/`, { quantity })
    set({ cart: data.data })
  },

  removeItem: async (itemId) => {
    await api.delete(`/cart/items/${itemId}/`)
    const { data } = await api.get('/cart/')
    set({ cart: data.data })
  },

  clearCart: async () => {
    await api.delete('/cart/')
    set({ cart: null })
  },
}))

interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme })
        if (typeof document !== 'undefined') {
          const root = document.documentElement
          if (theme === 'dark') root.classList.add('dark')
          else if (theme === 'light') root.classList.remove('dark')
          else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) root.classList.add('dark')
            else root.classList.remove('dark')
          }
        }
      },
    }),
    { name: 'cloudmart-theme' }
  )
)
