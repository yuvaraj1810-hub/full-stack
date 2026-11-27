'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Order } from '@/types'

const TRACK_STEPS = ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const STEP_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
}

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
    queryFn: () => api.get(`/orders/${orderId}/`).then((res) => res.data),
    enabled: isAuthenticated && Boolean(orderId),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
        <Navbar />
        <main className="flex-1 cm-container py-12 text-center text-sm text-[var(--cm-muted)]">
          Loading order details…
        </main>
        <Footer />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
        <Navbar />
        <main className="flex-1 cm-container py-12 space-y-4">
          <h1 className="text-2xl font-bold">Order not found</h1>
          <Link href="/account/orders" className="text-sm font-semibold text-[var(--cm-link)] hover:underline">
            ← My orders
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const addr = order.shipping_address_snapshot
  const normalizedStatus = order.status === 'OUT_FOR_DELIVERY' ? 'SHIPPED' : order.status
  const activeStepIdx = TRACK_STEPS.indexOf(normalizedStatus)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />

      <main className="flex-1 cm-container py-7 w-full">
        <Link href="/account/orders" className="text-sm font-semibold text-[var(--cm-link)] hover:underline">
          ← My orders
        </Link>

        <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] my-4">
          Order details
        </h1>

        <article className="panel space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold font-mono text-[var(--cm-ink)]">{order.order_number}</h2>
              <p className="text-sm text-[var(--cm-muted)] mt-1">
                {order.payment_method} ({order.payment_status}) · {formatINR(order.total_paise)}
              </p>
            </div>
            <span className="badge">{order.status}</span>
          </div>

          {/* Horizontal Progress Track matching CloudMart.module.css (.track) */}
          {order.status !== 'CANCELLED' && (
            <ol className="flex list-none p-0 gap-1 sm:gap-2 my-4 overflow-x-auto no-scrollbar">
              {TRACK_STEPS.map((step, i) => {
                const done = activeStepIdx >= 0 && i <= activeStepIdx
                return (
                  <li
                    key={step}
                    data-done={done}
                    className={`flex-1 min-w-[60px] pt-2.5 border-t-4 text-[10px] sm:text-xs md:text-sm font-semibold ${
                      done
                        ? 'border-[var(--cm-blue)] text-[var(--cm-link)]'
                        : 'border-[var(--cm-line)] text-[var(--cm-muted)]'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </li>
                )
              })}
            </ol>
          )}

          {/* Items */}
          <div className="divide-y divide-[var(--cm-line)]">
            {order.items.map((item) => (
              <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <strong className="text-sm sm:text-base text-[var(--cm-ink)] block">
                    {item.product_name}
                  </strong>
                  <p className="text-xs sm:text-sm text-[var(--cm-muted)] mt-0.5">
                    SKU: {item.sku} · {item.quantity} × {formatINR(item.unit_price_paise)}
                  </p>
                </div>
                <strong className="text-sm sm:text-base text-[var(--cm-ink)] shrink-0">
                  {formatINR(item.total_paise)}
                </strong>
              </div>
            ))}
          </div>

          {/* Address & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[var(--cm-line)] text-sm">
            <div>
              <h3 className="font-bold text-[var(--cm-ink)] mb-1">Delivery address</h3>
              {addr ? (
                <div className="text-[var(--cm-muted)] space-y-0.5">
                  <p className="font-semibold text-[var(--cm-ink)]">{addr.full_name}</p>
                  <p>{addr.address_line1}</p>
                  {addr.address_line2 && <p>{addr.address_line2}</p>}
                  <p>
                    {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  <p>Phone: {addr.phone}</p>
                </div>
              ) : (
                <p className="text-[var(--cm-muted)]">No address details available</p>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-[var(--cm-ink)] mb-1">Payment summary</h3>
              <p className="flex justify-between text-[var(--cm-muted)]">
                <span>Subtotal</span>
                <b className="text-[var(--cm-ink)]">{formatINR(order.subtotal_paise)}</b>
              </p>
              <p className="flex justify-between text-[var(--cm-muted)]">
                <span>Shipping</span>
                <b className="text-[var(--cm-ink)]">
                  {order.shipping_paise === 0 ? 'FREE' : formatINR(order.shipping_paise)}
                </b>
              </p>
              <p className="flex justify-between text-[var(--cm-muted)]">
                <span>GST</span>
                <b className="text-[var(--cm-ink)]">{formatINR(order.tax_paise)}</b>
              </p>
              <p className="flex justify-between text-base font-bold text-[var(--cm-ink)] pt-1.5 border-t border-[var(--cm-line)]">
                <span>Total</span>
                <span>{formatINR(order.total_paise)}</span>
              </p>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}
