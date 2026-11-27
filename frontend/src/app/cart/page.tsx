'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useCartStore, useAuthStore } from '@/lib/store'
import { formatINR, getImageUrl } from '@/lib/api'
import { toast } from 'sonner'

export default function CartPage() {
  const router = useRouter()
  const { cart, fetchCart, updateItem, removeItem, clearCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart().catch(() => {})
    }
  }, [isAuthenticated, fetchCart])

  const handleUpdateQuantity = async (itemId: number, currentQty: number, delta: number, availableStock: number) => {
    const newQty = currentQty + delta
    if (newQty <= 0) {
      handleRemoveItem(itemId)
      return
    }
    if (newQty > availableStock) {
      toast.error(`Only ${availableStock} items available in stock.`)
      return
    }

    try {
      setUpdatingItemId(itemId)
      await updateItem(itemId, newQty)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not update item quantity')
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    try {
      setUpdatingItemId(itemId)
      await removeItem(itemId)
      toast.success('Item removed from cart')
    } catch {
      toast.error('Could not remove item')
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleClearCart = async () => {
    if (!confirm('Are you sure you want to empty your cart?')) return
    try {
      setClearing(true)
      await clearCart()
      toast.success('Cart cleared')
    } catch {
      toast.error('Failed to clear cart')
    } finally {
      setClearing(false)
    }
  }

  const subtotalPaise = cart?.total_paise || 0
  const freeShippingThresholdPaise = 49900
  const shippingPaise = subtotalPaise === 0 || subtotalPaise >= freeShippingThresholdPaise ? 0 : 4900
  const taxPaise = Math.round(subtotalPaise * 0.18)
  const grandTotalPaise = subtotalPaise + shippingPaise + taxPaise

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />

      <main className="flex-1 cm-container w-full py-7">
        {!isAuthenticated ? (
          <div className="panel max-w-md mx-auto text-center space-y-4 my-10">
            <h1 className="text-2xl font-bold text-[var(--cm-ink)]">Sign in to view your cart</h1>
            <p className="text-sm text-[var(--cm-muted)]">
              Your shopping bag is stored in your CloudMart account.
            </p>
            <Link href="/login?next=/cart" className="btn-primary w-full text-sm">
              Sign in to CloudMart
            </Link>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="space-y-4">
            <h1 className="text-[2rem] font-bold text-[var(--cm-ink)]">Your cart is empty</h1>
            <Link href="/products" className="text-sm font-semibold text-[var(--cm-link)] hover:underline">
              Continue shopping →
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <h1 className="text-[2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em]">
                Your cart
              </h1>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={clearing}
                className="btn-secondary text-xs py-2 px-3"
              >
                {clearing ? 'Clearing…' : 'Clear cart'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
              {/* Items Panel */}
              <section className="panel divide-y divide-[var(--cm-line)]">
                {cart.items.map((item) => {
                  const variant = item.variant
                  const availableStock = variant.inventory?.available_quantity ?? 99
                  const itemImage = variant.product_image || variant.product?.primary_image?.image

                  return (
                    <article key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0">
                      {itemImage ? (
                        <img
                          src={getImageUrl(itemImage)}
                          alt={variant.product_name || variant.sku}
                          className="w-[85px] h-[70px] object-contain bg-white rounded-lg shrink-0 border border-[var(--cm-line)]"
                        />
                      ) : (
                        <span className="w-[85px] h-[70px] grid place-items-center bg-[var(--cm-tint)] text-[var(--cm-muted)] rounded-lg text-xs shrink-0">
                          Item
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <Link
                          href={variant.product_slug ? `/products/${variant.product_slug}` : `/products?search=${encodeURIComponent(variant.product_name || variant.sku)}`}
                          className="font-semibold text-[var(--cm-link)] hover:underline block truncate"
                        >
                          {variant.product_name || `SKU: ${variant.sku}`}
                        </Link>
                        <p className="text-sm text-[var(--cm-muted)] my-1">
                          {formatINR(variant.price_paise)} each
                        </p>

                        <div className="flex flex-wrap items-center gap-2.5 mt-2">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={item.quantity <= 1 || updatingItemId === item.id}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, -1, availableStock)}
                            className="btn-primary py-1.5 px-3 text-sm"
                          >
                            −
                          </button>
                          <b className="text-sm font-bold min-w-[20px] text-center">
                            {updatingItemId === item.id ? '…' : item.quantity}
                          </b>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={item.quantity >= availableStock || updatingItemId === item.id}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, 1, availableStock)}
                            className="btn-primary py-1.5 px-3 text-sm"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            disabled={updatingItemId === item.id}
                            onClick={() => handleRemoveItem(item.id)}
                            className="btn-secondary py-1.5 px-3 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="text-right font-bold text-sm sm:text-base text-[var(--cm-ink)] shrink-0">
                        {formatINR(item.subtotal_paise)}
                      </div>
                    </article>
                  )
                })}
              </section>

              {/* Order Summary Aside */}
              <aside className="panel space-y-3 lg:sticky lg:top-28">
                <h2 className="text-xl font-bold text-[var(--cm-ink)] mb-2">Order summary</h2>

                {cart.items.map((item) => (
                  <p key={item.id} className="flex justify-between gap-2 text-sm text-[var(--cm-muted)]">
                    <span className="truncate">
                      {item.variant.product_name || item.variant.sku} × {item.quantity}
                    </span>
                    <b className="text-[var(--cm-ink)] shrink-0">{formatINR(item.subtotal_paise)}</b>
                  </p>
                ))}

                <div className="flex justify-between text-sm text-[var(--cm-muted)]">
                  <span>Shipping</span>
                  <b className="text-[var(--cm-ink)]">{shippingPaise === 0 ? 'FREE' : formatINR(shippingPaise)}</b>
                </div>

                <div className="flex justify-between text-sm text-[var(--cm-muted)]">
                  <span>Estimated GST (18%)</span>
                  <b className="text-[var(--cm-ink)]">{formatINR(taxPaise)}</b>
                </div>

                <hr className="border-t border-[var(--cm-line)] my-2" />

                <h3 className="flex justify-between items-baseline text-lg font-bold text-[var(--cm-ink)]">
                  <span>Total</span>
                  <span>{formatINR(grandTotalPaise)}</span>
                </h3>

                <Link href="/checkout" className="btn-primary w-full text-sm mt-2 no-underline">
                  Proceed to checkout
                </Link>
              </aside>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
