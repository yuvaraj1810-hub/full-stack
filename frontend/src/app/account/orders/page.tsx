'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Order, PaginatedResponse } from '@/types'

export default function CustomerOrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?next=/account/orders')
    }
  }, [authLoading, isAuthenticated, router])

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<Order>>({
    queryKey: ['customer-orders'],
    queryFn: () => api.get('/orders/').then((res) => res.data),
    enabled: isAuthenticated,
  })

  const orders = data?.results || []

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />

      <main className="flex-1 cm-container py-7 w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em]">
            My orders
          </h1>
          <button type="button" onClick={() => refetch()} className="btn-secondary text-xs py-2 px-3">
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel animate-pulse space-y-2">
                <div className="h-5 bg-[var(--cm-tint)] rounded w-1/4" />
                <div className="h-4 bg-[var(--cm-tint)] rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="panel text-center py-8 space-y-3">
            <p className="text-red-500 font-semibold">Could not load your orders.</p>
            <button type="button" onClick={() => refetch()} className="btn-secondary text-sm">
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[var(--cm-muted)]">No orders yet. Your purchases will appear here.</p>
            <Link href="/products" className="btn-primary text-sm no-underline">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {orders.map((order) => (
              <article key={order.id} className="panel space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <b className="font-mono text-base text-[var(--cm-ink)]">{order.order_number}</b>
                  <div className="flex items-center gap-2">
                    <span className="badge">{order.payment_status}</span>
                    <span className="badge">{order.status}</span>
                  </div>
                </div>
                <p className="text-sm text-[var(--cm-muted)]">
                  {new Date(order.created_at).toLocaleDateString('en-IN')} · {formatINR(order.total_paise)} ·{' '}
                  {order.payment_method}
                </p>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="inline-block text-sm font-semibold text-[var(--cm-link)] hover:underline"
                >
                  View order details →
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
