'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { DashboardMetrics } from '@/types'
import { Package, ShoppingCart, TrendingUp, AlertTriangle, CreditCard, Truck, XCircle, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

function MetricCard({ title, value, icon: Icon, color, sub }: {
  title: string; value: string | number; icon: any; color: string; sub?: string
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const statusColors: Record<string, string> = {
  PLACED: 'badge bg-blue-900/40 text-blue-300',
  CONFIRMED: 'badge bg-cyan-900/40 text-cyan-300',
  PROCESSING: 'badge bg-yellow-900/40 text-yellow-300',
  SHIPPED: 'badge bg-purple-900/40 text-purple-300',
  OUT_FOR_DELIVERY: 'badge bg-orange-900/40 text-orange-300',
  DELIVERED: 'badge bg-green-900/40 text-green-300',
  CANCELLED: 'badge bg-red-900/40 text-red-300',
  PENDING: 'badge bg-yellow-900/40 text-yellow-300',
  PAID: 'badge bg-green-900/40 text-green-300',
  COLLECTED: 'badge bg-green-900/40 text-green-300',
  FAILED: 'badge bg-red-900/40 text-red-300',
}

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardMetrics }>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard/').then(r => r.data),
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="p-8 text-red-400">Failed to load dashboard metrics.</div>
    )
  }

  const m = data.data

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Real-time CloudMart metrics</p>
      </div>

      {/* Product Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Products</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard title="Total Products" value={m.products.total} icon={Package} color="bg-blue-600" />
          <MetricCard title="Active Products" value={m.products.active} icon={CheckCircle} color="bg-green-600" />
          <MetricCard title="Low Stock" value={m.products.low_stock} icon={AlertTriangle} color="bg-orange-600" sub="≤ 10 units remaining" />
        </div>
      </section>

      {/* Order Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Orders</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Orders" value={m.orders.total} icon={ShoppingCart} color="bg-purple-600" />
          <MetricCard title="Pending" value={m.orders.pending} icon={ShoppingCart} color="bg-yellow-600" />
          <MetricCard title="Confirmed" value={m.orders.confirmed} icon={CheckCircle} color="bg-cyan-600" />
          <MetricCard title="Delivered" value={m.orders.delivered} icon={Truck} color="bg-green-600" />
          <MetricCard title="Cancelled" value={m.orders.cancelled} icon={XCircle} color="bg-red-600" />
          <MetricCard title="COD Orders" value={m.orders.cod} icon={CreditCard} color="bg-indigo-600" />
          <MetricCard title="UPI Orders" value={m.orders.upi} icon={CreditCard} color="bg-violet-600" />
        </div>
      </section>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricCard title="Collected Revenue" value={formatINR(m.revenue.collected_paise)} icon={TrendingUp} color="bg-green-600" sub="Paid + COD Collected" />
          <MetricCard title="Pending Collection" value={formatINR(m.revenue.pending_paise)} icon={TrendingUp} color="bg-yellow-600" sub="Outstanding COD + pending UPI" />
        </div>
      </section>

      {/* Recent Orders */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  {['Order #', 'Customer', 'Total', 'Method', 'Payment', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {m.recent_orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-xs">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{order.customer_name || order.customer_email}</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatINR(order.total_paise)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${order.payment_method === 'COD' ? 'bg-indigo-900/40 text-indigo-300' : 'bg-violet-900/40 text-violet-300'}`}>
                        {order.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusColors[order.payment_status] || 'badge bg-gray-700 text-gray-300'}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusColors[order.status] || 'badge bg-gray-700 text-gray-300'}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {format(new Date(order.created_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {m.recent_orders.length === 0 && (
              <div className="p-8 text-center text-gray-500">No orders yet.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
