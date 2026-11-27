'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, useCartStore } from '@/lib/store'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/'

  const { login, isLoading } = useAuthStore()
  const { fetchCart } = useCartStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    try {
      await login(email.trim(), password)
      toast.success('Welcome back to CloudMart!')
      await fetchCart().catch(() => {})
      router.push(nextUrl)
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Please check your details and try again.'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  const handleFillDemo = (type: 'customer' | 'admin') => {
    if (type === 'customer') {
      setEmail('customer@cloudmart.local')
      setPassword('Customer@1234')
    } else {
      setEmail('admin@cloudmart.local')
      setPassword('Admin@1234')
    }
    setErrorMessage(null)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel w-full max-w-[410px] p-6 sm:p-[34px] shadow-[0_12px_45px_rgba(19,34,66,0.08)]"
    >
      <Link
        href="/"
        className="text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)] inline-block mb-3 no-underline"
      >
        Cloud<span className="text-[var(--cm-link)]">Mart</span>
      </Link>

      <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mb-1.5">
        Welcome back
      </h1>
      <p className="text-sm text-[var(--cm-muted)] mb-5">
        Sign in to your CloudMart account.
      </p>

      {errorMessage && (
        <p role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium">
          {errorMessage}
        </p>
      )}

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field text-sm"
        />
      </label>

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Password</span>
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field text-sm"
        />
      </label>

      <label className="flex items-center gap-2.5 font-semibold text-sm text-[var(--cm-ink)] my-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="w-4 h-4 accent-[var(--cm-blue)] rounded"
        />
        <span>Show password</span>
      </label>

      <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-sm mt-2">
        {isLoading ? 'Please wait…' : 'Sign in'}
      </button>

      {/* Quick Fill Demo Accounts */}
      <div className="mt-5 pt-4 border-t border-[var(--cm-line)]">
        <p className="text-xs text-[var(--cm-muted)] text-center mb-2">
          Quick fill demo accounts:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleFillDemo('customer')}
            className="btn-secondary text-xs py-2"
          >
            Demo Customer
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo('admin')}
            className="btn-secondary text-xs py-2"
          >
            Demo Admin
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        New to CloudMart?{' '}
        <Link href="/register" className="text-[var(--cm-link)] font-semibold hover:underline">
          Create account
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--cm-bg)] text-[var(--cm-ink)] px-4 py-8">
      <Suspense fallback={<div className="text-sm text-[var(--cm-muted)]">Loading CloudMart…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
