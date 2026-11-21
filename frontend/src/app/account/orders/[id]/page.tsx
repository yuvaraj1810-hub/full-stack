'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { 
  Package, 
  ArrowLeft, 
  Clock, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  CreditCard,
  Banknote
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Order } from '@/types'

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()
  const orderId = params?.id

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?next=/account/orders/${orderId}`)
    }
  }, [authLoading, isAuthenticated, router, orderId])

  const { data: order, isLoading, isError } = useQuery<Order>({
    queryKey: ['customer-order-detail', orderId],
    queryFn: () => api.get(`/orders/${orderId}/`).then(res => res.data),
    enabled: isAuthenticated && Boolean(orderId),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Navbar />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-12 text-center text-sm text-gray-500">
          Loading order details...
        </main>
        <Footer />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Navbar />
        <main className="flex-1 max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle size={36} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Order Not Found</h2>
          <p className="text-sm text-gray-500">
            This order could not be located or does not belong to your account.
          </p>
          <Link href="/account/orders" className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to My Orders
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const addr = order.shipping_address_snapshot

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/account/orders"
            className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft size={14} /> Back to all orders
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
              Order Details
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 dark:text-white font-mono mt-0.5">
              {order.order_number}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Placed on {new Date(order.created_at).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`badge ${
              order.payment_status === 'PAID'
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
            }`}>
              Payment: {order.payment_status}
            </span>
            <span className="badge bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {order.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items & Status History */}
          <div className="lg:col-span-8 space-y-6">
            {/* Items */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-950 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800">
                Purchased Items ({order.items.length})
              </h2>

              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {order.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {item.product_name}
                      </h4>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>SKU: {item.sku}</span>
                        <span>•</span>
                        <span>Qty: {item.quantity}</span>
                        <span>•</span>
                        <span>{formatINR(item.unit_price_paise)} each</span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-950 dark:text-white">
                      {formatINR(item.total_paise)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Timeline */}
            {order.status_history && order.status_history.length > 0 && (
              <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4">
                <h2 className="text-base font-bold text-gray-950 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800">
                  Status History
                </h2>

                <div className="space-y-3">
                  {order.status_history.map((hist) => (
                    <div key={hist.id} className="flex items-start gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {hist.to_status} ({hist.payment_status})
                          </span>
                          <span className="text-gray-400">
                            {new Date(hist.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {hist.notes && (
                          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{hist.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Delivery & Payment Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Delivery Address */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-950 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-800">
                <MapPin size={16} className="text-blue-600 dark:text-blue-400" /> Shipping Address
              </div>
              {addr ? (
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                  <p className="font-bold text-gray-900 dark:text-white">{addr.full_name}</p>
                  <p>{addr.address_line1}</p>
                  {addr.address_line2 && <p>{addr.address_line2}</p>}
                  <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                  <p className="text-gray-500 pt-1">Phone: {addr.phone}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No address details available</p>
              )}
            </div>

            {/* Payment Summary */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-3 text-sm">
              <div className="flex items-center gap-2 font-bold text-gray-950 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-800">
                {order.payment_method === 'COD' ? <Banknote size={16} className="text-green-600" /> : <CreditCard size={16} className="text-blue-600" />}
                Payment Summary
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Method</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {order.payment_method === 'COD' ? 'Cash on Delivery (COD)' : 'UPI'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatINR(order.subtotal_paise)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {order.shipping_paise === 0 ? 'FREE' : formatINR(order.shipping_paise)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>GST</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatINR(order.tax_paise)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-baseline text-sm">
                  <span className="font-bold text-gray-950 dark:text-white">Total</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 text-lg">
                    {formatINR(order.total_paise)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
