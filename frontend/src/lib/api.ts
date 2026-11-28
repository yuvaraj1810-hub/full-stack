import axios from 'axios'

// In the browser we always use relative URLs so requests go through the
// Next.js reverse-proxy rewrite (/api/v1/* → http://backend:8000/api/v1/*).
// On the server side (SSR) we can call the backend directly.
const API_URL =
  typeof window === 'undefined'
    ? (process.env.BACKEND_INTERNAL_URL || 'http://backend:8000')
    : ''

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
  withCredentials: true,
})

// Auto-refresh on 401 using HttpOnly refresh cookie
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const url: string = original?.url || ''
    const isAuthEndpoint =
      url.includes('/auth/login/') ||
      url.includes('/auth/register/') ||
      url.includes('/auth/token/refresh/') ||
      url.includes('/auth/forgot-password/') ||
      url.includes('/auth/reset-password/')

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        await axios.post(`${API_URL}/api/v1/auth/token/refresh/`, {}, { withCredentials: true })
        return api(original)
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cloudmart-auth')
          const path = window.location.pathname
          const isPublicRoute =
            path === '/user' ||
            path === '/user/' ||
            path.startsWith('/user/welcome') ||
            path.startsWith('/user/products') ||
            path.startsWith('/user/login') ||
            path.startsWith('/user/register') ||
            path.startsWith('/user/forgot-password') ||
            path.startsWith('/user/reset-password')
          if (!url.includes('/auth/me/') && !isPublicRoute) {
            window.location.href = '/user/login'
          }
        }
      }
    }
    return Promise.reject(error)
  }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatINR = (paise: number): string => {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees)
}

export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/user/placeholder-product.svg'
  if (path.startsWith('http')) {
    // Strip any absolute backend origin so the image is served via the proxy
    try {
      const url = new URL(path)
      return url.pathname
    } catch {
      return path
    }
  }
  return path
}
