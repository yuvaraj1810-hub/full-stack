'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import CaptchaBox, { isAllowedEmailDomain } from '@/components/CaptchaBox'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { register, isLoading } = useAuthStore()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[e.target.name]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.username.trim()) {
      errors.username = 'Username is required.'
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters.'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.'
    } else if (!isAllowedEmailDomain(formData.email.trim())) {
      errors.email = 'Only Gmail (@gmail.com) and Microsoft (@outlook.com, @hotmail.com, @live.com, @msn.com) emails are allowed.'
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required.'
    } else if (!/^\d{10}$/.test(formData.phone.replace(/[\s+-]/g, ''))) {
      errors.phone = 'Enter a valid 10-digit phone number.'
    }

    if (!formData.password) {
      errors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.'
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setCaptchaError(null)

    if (!validate()) return

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setCaptchaError('Incorrect CAPTCHA code. Please try again.')
      return
    }

    const payload = {
      username: formData.username.trim().toLowerCase(),
      email: formData.email.trim().toLowerCase(),
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
      confirm_password: formData.confirmPassword,
    }

    try {
      const res = await register(payload)
      const createdEmail = res?.data?.user?.email || payload.email
      const apiMsg = res?.message || 'Account created successfully'
      toast.success(`${apiMsg} (${createdEmail}). Please sign in with your credentials.`)
      const nextParam = searchParams.get('next')
      router.push(nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login')
    } catch (err: any) {
      const respData = err.response?.data
      if (typeof respData === 'object' && respData !== null) {
        const keyMap: Record<string, string> = {
          confirm_password: 'confirmPassword',
          first_name: 'firstName',
          last_name: 'lastName',
        }
        const extracted: Record<string, string> = {}
        for (const [key, val] of Object.entries(respData)) {
          const mappedKey = keyMap[key] || key
          if (Array.isArray(val)) extracted[mappedKey] = val.join(' ')
          else if (typeof val === 'string') extracted[mappedKey] = val
        }
        setFieldErrors(extracted)
        const topMsg =
          extracted.detail ||
          extracted.message ||
          extracted.non_field_errors ||
          Object.values(extracted)[0] ||
          'Please correct the highlighted fields.'
        setGeneralError(topMsg)
        toast.error(topMsg)
      } else {
        const status = err.response?.status
        const msg = status
          ? `Registration failed (HTTP ${status}). Make sure the backend server and database are running.`
          : 'Cannot reach the server. Please make sure the backend API is running.'
        setGeneralError(msg)
        toast.error(msg)
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel w-full max-w-[460px] p-6 sm:p-[34px] shadow-[0_12px_45px_rgba(19,34,66,0.08)]"
    >
      <Link
        href="/welcome"
        className="text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)] inline-block mb-3 no-underline"
      >
        Cloud<span className="text-[var(--cm-link)]">Mart</span>
      </Link>

      <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mb-1.5">
        Sign up
      </h1>
      <p className="text-sm text-[var(--cm-muted)] mb-5">
        Create your CloudMart account.
      </p>

      {generalError && (
        <p role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium">
          {generalError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)]">
          <span>First name</span>
          <input
            type="text"
            name="firstName"
            autoComplete="given-name"
            placeholder="Jane"
            value={formData.firstName}
            onChange={handleChange}
            className="input-field text-sm"
          />
        </label>

        <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)]">
          <span>Last name</span>
          <input
            type="text"
            name="lastName"
            autoComplete="family-name"
            placeholder="Doe"
            value={formData.lastName}
            onChange={handleChange}
            className="input-field text-sm"
          />
        </label>
      </div>

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Username</span>
        <input
          type="text"
          name="username"
          required
          autoComplete="username"
          placeholder="janedoe"
          value={formData.username}
          onChange={handleChange}
          className="input-field text-sm"
        />
        {fieldErrors.username && <small className="text-red-500 font-normal">{fieldErrors.username}</small>}
      </label>

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@gmail.com"
          value={formData.email}
          onChange={handleChange}
          className="input-field text-sm"
        />
        {fieldErrors.email && <small className="text-red-500 font-normal">{fieldErrors.email}</small>}
      </label>

      <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)] my-3">
        <span>Phone number</span>
        <input
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          placeholder="9876543210"
          value={formData.phone}
          onChange={handleChange}
          className="input-field text-sm"
        />
        {fieldErrors.phone && <small className="text-red-500 font-normal">{fieldErrors.phone}</small>}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
        <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)]">
          <span>Password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            className="input-field text-sm"
          />
          {fieldErrors.password && <small className="text-red-500 font-normal">{fieldErrors.password}</small>}
        </label>

        <label className="grid gap-1.5 font-semibold text-sm text-[var(--cm-ink)]">
          <span>Confirm password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="input-field text-sm"
          />
          {fieldErrors.confirmPassword && <small className="text-red-500 font-normal">{fieldErrors.confirmPassword}</small>}
        </label>
      </div>

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
        {isLoading ? 'Creating account…' : 'Sign up'}
      </button>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--cm-link)] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--cm-bg)] text-[var(--cm-ink)] px-4 py-8">
      <Suspense fallback={<div className="text-sm text-[var(--cm-muted)]">Loading CloudMart…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
