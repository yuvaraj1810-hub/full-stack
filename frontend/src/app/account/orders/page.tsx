'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Package, Clock, ArrowRight, ShoppingBag, AlertCircle, CheckCircle, Truck, RefreshCw } from 'lucide-react'
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
    queryFn: () => api.get('/orders/').then(res => res.data),
    enabled: isAuthenticated,
  })

  const orders = data?.results || []

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">My Orders</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight">
              My Orders
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review current and previous CloudMart purchases
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs py-2 px-3 self-start sm:self-auto flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Refresh Orders
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-full mt-2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="card p-12 text-center max-w-md mx-auto space-y-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <AlertCircle size={36} className="text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Could Not Load Orders</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              There was an issue fetching your order history.
            </p>
            <button onClick={() => refetch()} className="btn-secondary text-sm py-2 px-4">
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto space-y-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <Package size={40} className="text-gray-400 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Orders Placed Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              When you purchase items via COD or UPI, your orders will appear here.
            </p>
            <Link href="/products" className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
              Browse Products <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isPaid = order.payment_status === 'PAID'
              const isDelivered = order.status === 'DELIVERED'

              return (
                <div
                  key={order.id}
                  className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Order Reference</span>
                      <h3 className="font-mono font-bold text-base text-gray-950 dark:text-white">
                        {order.order_number}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${
                        isPaid 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      }`}>
                        Payment: {order.payment_status}
                      </span>
                      <span className={`badge ${
                        isDelivered
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      }`}>
                        Status: {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p>
                        <span className="font-semibold text-gray-900 dark:text-white">Payment Method:</span>{' '}
                        {order.payment_method === 'COD' ? 'Cash on Delivery (COD)' : 'UPI'}
                      </p>
                      {order.shipping_address_snapshot && (
                        <p className="text-gray-500 dark:text-gray-400">
                          Ship to: {order.shipping_address_snapshot.full_name}, {order.shipping_address_snapshot.city}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Total</span>
                        <span className="text-lg font-extrabold text-gray-950 dark:text-white">
                          {formatINR(order.total_paise)}
                        </span>
                      </div>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
                      >
                        Details <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
