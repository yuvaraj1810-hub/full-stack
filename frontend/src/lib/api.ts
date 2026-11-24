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
  withCredentials: false,
})

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (refresh) {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/token/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        }
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        if (typeof window !== 'undefined') window.location.href = '/login'
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
  if (!path) return '/placeholder-product.svg'
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
