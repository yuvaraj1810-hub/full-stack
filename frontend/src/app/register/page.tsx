'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingBag, Eye, EyeOff, Lock, Mail, User, Phone, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

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
    <div className="w-full max-w-lg mx-auto">
      <div className="card p-8 shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mb-3">
            <ShoppingBag size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create an Account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Join CloudMart to experience seamless shopping, instant UPI & COD checkout
          </p>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {generalError}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Rahul"
                  className="input-field pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Sharma"
                className="input-field text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Username *
            </label>
            <input
              type="text"
              name="username"
              required
              value={formData.username}
              onChange={handleChange}
              placeholder="rahulsharma"
              className={`input-field text-sm ${fieldErrors.username ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            />
            {fieldErrors.username && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="rahul@example.com"
                className={`input-field pl-10 text-sm ${fieldErrors.email ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543210"
                className={`input-field pl-10 text-sm ${fieldErrors.phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              />
            </div>
            {fieldErrors.phone && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Password * (min 8)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`input-field pl-10 text-sm ${fieldErrors.password ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`input-field pl-10 text-sm ${fieldErrors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show passwords
            </label>
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-green-500" /> 256-bit Secure
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm mt-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link
            href={`/login${nextUrl !== '/products' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="text-center py-12 text-sm text-gray-500">Loading sign up...</div>}>
          <RegisterForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
