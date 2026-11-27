'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, useCartStore } from '@/lib/store'
import { toast } from 'sonner'
import CaptchaBox, { isAllowedEmailDomain } from '@/components/CaptchaBox'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/'

  const { login, isLoading } = useAuthStore()
  const { fetchCart } = useCartStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setCaptchaError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    if (!isAllowedEmailDomain(trimmedEmail)) {
      setErrorMessage('Only Gmail (@gmail.com) and Microsoft (@outlook.com, @hotmail.com, @live.com, @msn.com) email addresses are allowed.')
      return
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setCaptchaError('Incorrect CAPTCHA code. Please try again.')
      return
    }

    try {
      await login(trimmedEmail, password)
      toast.success('Welcome back to CloudMart!')
      await fetchCart().catch(() => {})
      router.push(nextUrl)
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Invalid email or password. Please verify your details and try again.'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel w-full max-w-[420px] p-6 sm:p-[34px] shadow-[0_12px_45px_rgba(19,34,66,0.08)]"
    >
      <Link
        href="/welcome"
        className="text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)] inline-block mb-3 no-underline"
      >
        Cloud<span className="text-[var(--cm-link)]">Mart</span>
      </Link>

      <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mb-1.5">
        Sign in
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
          placeholder="you@gmail.com"
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

      <label className="flex items-center gap-2.5 font-semibold text-sm text-[var(--cm-ink)] my-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="w-4 h-4 accent-[var(--cm-blue)] rounded"
        />
        <span>Show password</span>
      </label>

      {/* CAPTCHA below Password */}
      <CaptchaBox
        value={captchaInput}
        onChange={setCaptchaInput}
        onCodeChange={setCaptchaCode}
        error={captchaError}
      />

      <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-sm mt-2">
        {isLoading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        New to CloudMart?{' '}
        <Link href="/register" className="text-[var(--cm-link)] font-semibold hover:underline">
          Sign up
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
