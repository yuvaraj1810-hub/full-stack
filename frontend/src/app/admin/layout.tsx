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
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated || !user?.is_staff) return null

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
