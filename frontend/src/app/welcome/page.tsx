'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'

export default function WelcomePage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login')
    }, 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--cm-bg)] text-[var(--cm-ink)] px-4 py-8">
      <section className="panel w-full max-w-2xl text-center py-14 sm:py-16 px-6 sm:px-12 shadow-[0_12px_45px_rgba(19,34,66,0.08)] space-y-5">
        {/* CloudMart Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--cm-tint)] text-[var(--cm-blue)] mx-auto">
          <ShoppingBag size={32} strokeWidth={2.2} />
        </div>

        {/* Heartful Welcome Content */}
        <p className="text-xl sm:text-3xl font-semibold text-[var(--cm-ink)] tracking-[-0.02em] leading-snug">
          Heartful Welcome to CloudMart
        </p>

        {/* Much Bigger CloudMart Display Heading */}
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-[-0.055em] text-[var(--cm-ink)] leading-none my-3">
          Cloud<span className="text-[var(--cm-link)]">Mart</span>
        </h1>

        <p className="text-xs text-[var(--cm-muted)] pt-2">
          Redirecting to Sign in...
        </p>
      </section>
    </div>
  )
}
