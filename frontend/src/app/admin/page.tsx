'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { DashboardMetrics } from '@/types'
import Link from 'next/link'

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardMetrics }>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard/').then((r) => r.data),
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-[var(--cm-tint)] rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data?.data) {
    return <div className="panel text-red-500">Failed to load dashboard metrics.</div>
  }

  const m = data.data

  return (
    <div className="space-y-5">
      <div>
        <small className="text-xs text-[var(--cm-muted)]">CloudMart Admin</small>
        <h1 className="text-[1.75rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mt-1">
          Store overview
        </h1>
      </div>

      {/* Top 3 Stat Cards matching ZIP (.stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="panel">
          <small className="text-xs text-[var(--cm-muted)]">Orders</small>
          <h2 className="text-2xl font-bold text-[var(--cm-ink)] mt-2">{m.orders.total}</h2>
          <small className="text-xs text-[var(--cm-muted)]">
            {m.orders.pending} pending · {m.orders.delivered} delivered
          </small>
        </article>
        <article className="panel">
          <small className="text-xs text-[var(--cm-muted)]">Collected revenue</small>
          <h2 className="text-2xl font-bold text-[var(--cm-ink)] mt-2">
            {formatINR(m.revenue.collected_paise)}
          </h2>
          <small className="text-xs text-[var(--cm-muted)]">
            {formatINR(m.revenue.pending_paise)} pending collection
          </small>
        </article>
        <article className="panel">
          <small className="text-xs text-[var(--cm-muted)]">Low stock</small>
          <h2 className="text-2xl font-bold text-[var(--cm-ink)] mt-2">{m.products.low_stock}</h2>
          <small className="text-xs text-[var(--cm-muted)]">
            {m.products.active} active / {m.products.total} total products
          </small>
        </article>
      </div>

      {/* Recent Orders Table */}
      <section className="panel space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--cm-ink)]">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-[var(--cm-link)] hover:underline">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--cm-line)] text-[var(--cm-muted)]">
                {['Order', 'Customer', 'Amount', 'Payment', 'Status'].map((h) => (
                  <th key={h} className="py-2.5 px-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.recent_orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--cm-line)] last:border-b-0">
                  <td className="py-3 px-2.5">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs font-semibold text-[var(--cm-link)] hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="py-3 px-2.5 text-[var(--cm-ink)]">
                    {order.customer_name || order.customer_email}
                  </td>
                  <td className="py-3 px-2.5 font-semibold text-[var(--cm-ink)]">
                    {formatINR(order.total_paise)}
                  </td>
                  <td className="py-3 px-2.5">
                    <span className="badge">{order.payment_method}</span>
                  </td>
                  <td className="py-3 px-2.5">
                    <span className="badge">{order.status}</span>
                  </td>
                </tr>
              ))}
              {m.recent_orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-[var(--cm-muted)]">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
