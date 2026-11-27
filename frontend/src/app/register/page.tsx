'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/products'

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

    if (!validate()) return

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
      await register(payload)
      toast.success('Account created successfully! Welcome to CloudMart.')
      router.push(nextUrl)
    } catch (err: any) {
      const respData = err.response?.data
      if (typeof respData === 'object' && respData !== null) {
        const extracted: Record<string, string> = {}
        for (const [key, val] of Object.entries(respData)) {
          if (Array.isArray(val)) extracted[key] = val.join(' ')
          else if (typeof val === 'string') extracted[key] = val
        }
        setFieldErrors(extracted)
        if (extracted.detail || extracted.message) {
          setGeneralError(extracted.detail || extracted.message)
        } else {
          setGeneralError('Please correct the highlighted fields.')
        }
      } else {
        const msg = 'Registration failed. Please check your information and try again.'
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
        href="/"
        className="text-[1.75rem] font-extrabold tracking-[-0.065em] text-[var(--cm-ink)] inline-block mb-3 no-underline"
      >
        Cloud<span className="text-[var(--cm-link)]">Mart</span>
      </Link>

      <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mb-1.5">
        Create account
      </h1>
      <p className="text-sm text-[var(--cm-muted)] mb-5">
        Enter your details to get started.
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
          placeholder="you@example.com"
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
        {isLoading ? 'Please wait…' : 'Create account'}
      </button>

      <p className="text-sm text-[var(--cm-muted)] text-center mt-4 mb-0">
        Already registered?{' '}
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
