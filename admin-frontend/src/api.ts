import axios from 'axios'

export const ACCESS_KEY = 'cm_admin_access'
export const REFRESH_KEY = 'cm_admin_refresh'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const url: string = original?.url || ''
    const isAuthEndpoint = url.includes('/auth/login/') || url.includes('/auth/token/refresh/')
    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        await axios.post('/api/v1/auth/token/refresh/', {}, { withCredentials: true })
        return api(original)
      } catch {
        localStorage.removeItem(ACCESS_KEY)
        localStorage.removeItem(REFRESH_KEY)
      }
    }
    return Promise.reject(error)
  }
)

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((paise || 0) / 100)

export const getImageUrl = (path?: string | null) => {
  if (!path) return ''
  if (path.startsWith('http')) {
    try {
      return new URL(path).pathname
    } catch {
      return path
    }
  }
  return path
}
