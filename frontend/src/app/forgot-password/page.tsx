'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { toast } from 'sonner'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSubmittedMsg(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.')
      return
    }

    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password/', { email: trimmedEmail })
      const msg = data?.message || 'If an account with that email exists, a password reset link has been sent.'
      setSubmittedMsg(msg)
      toast.success(msg)
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Unable to process request. Please try again later.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
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
        Forgot password
      </h1>
      <p className="text-sm text-[var(--cm-muted)] mb-5">
        Enter your registered email to receive a password reset link.
      </p>

      {errorMsg && (
        <p role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium">
          {errorMsg}
        </p>
      )}

      {submittedMsg && (
        <p role="status" className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-600 dark:text-green-400 font-medium">
          {submittedMsg}
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

      <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-sm mt-2">
        {isLoading ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        Remembered your password?{' '}
        <Link href="/login" className="text-[var(--cm-link)] font-semibold hover:underline">
          Back to Sign in
        </Link>
      </p>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--cm-bg)] text-[var(--cm-ink)] px-4 py-8">
      <Suspense fallback={<div className="text-sm text-[var(--cm-muted)]">Loading CloudMart…</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}
