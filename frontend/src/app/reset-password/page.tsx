'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'sonner'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!uid || !token) {
      setErrorMsg('Invalid or missing password reset token.')
      return
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/reset-password/', {
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      toast.success(data?.message || 'Password reset successfully. Please sign in.')
      router.push('/login')
    } catch (err: any) {
      const resp = err.response?.data
      const msg =
        resp?.message ||
        (Array.isArray(resp?.new_password) ? resp.new_password.join(' ') : null) ||
        resp?.detail ||
        'Could not reset password. The link may have expired.'
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
        Reset password
      </h1>
      <p className="text-sm text-[var(--cm-muted)] mb-5">
        Choose a strong new password for your CloudMart account.
      </p>

      {errorMsg && (
        <p role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium">
          {errorMsg}
        </p>
      )}

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>New password</span>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input-field text-sm"
        />
      </label>

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Confirm new password</span>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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

      <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-sm mt-2">
        {isLoading ? 'Updating…' : 'Reset password'}
      </button>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        <Link href="/login" className="text-[var(--cm-link)] font-semibold hover:underline">
          Back to Sign in
        </Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--cm-bg)] text-[var(--cm-ink)] px-4 py-8">
      <Suspense fallback={<div className="text-sm text-[var(--cm-muted)]">Loading CloudMart…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
