'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loadUser } = useAuthStore()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      await loadUser()
      setChecking(false)
    }
    check()
  }, [])

  useEffect(() => {
    if (!checking) {
      if (!isAuthenticated) router.replace('/login?next=/admin')
      else if (!user?.is_staff) router.replace('/')
    }
  }, [checking, isAuthenticated, user])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--cm-bg)]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--cm-blue)]" />
      </div>
    )
  }

  if (!isAuthenticated || !user?.is_staff) return null

  return (
    <div className="min-h-screen bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <div className="cm-container py-6 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-5 items-start">
        <AdminSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
