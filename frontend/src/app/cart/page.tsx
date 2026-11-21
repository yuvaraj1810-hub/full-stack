'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  RotateCcw,
  ShoppingBag,
  AlertCircle
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useCartStore, useAuthStore } from '@/lib/store'
import { formatINR, getImageUrl } from '@/lib/api'
import { toast } from 'sonner'

export default function CartPage() {
  const router = useRouter()
  const { cart, isLoading, fetchCart, updateItem, removeItem, clearCart } = useCartStore()
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
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error('Failed to clear cart')
    } finally {
      setClearing(false)
    }
  }

  // Calculate pricing server-matching logic
  const subtotalPaise = cart?.total_paise || 0
  const freeShippingThresholdPaise = 49900 // ₹499
  const shippingPaise = subtotalPaise === 0 || subtotalPaise >= freeShippingThresholdPaise ? 0 : 4900 // ₹49
  const taxPaise = Math.round(subtotalPaise * 0.18) // 18% GST
  const grandTotalPaise = subtotalPaise + shippingPaise + taxPaise
  const amountToFreeShipping = Math.max(0, freeShippingThresholdPaise - subtotalPaise)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">Shopping Cart</span>
        </div>

        {!isAuthenticated ? (
          <div className="card p-12 text-center max-w-md mx-auto space-y-5 my-12 bg-white dark:bg-gray-900">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <ShoppingCart size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign In to View Your Cart</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your shopping bag is safely stored in your CloudMart account. Sign in to view items and checkout.
              </p>
            </div>
            <Link href="/login?next=/cart" className="btn-primary w-full py-2.5 text-sm inline-flex items-center justify-center gap-2">
              Sign In to CloudMart <ArrowRight size={16} />
            </Link>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto space-y-5 my-12 bg-white dark:bg-gray-900">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto">
              <ShoppingBag size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Cart is Empty</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Looks like you haven't added anything to your cart yet. Explore our catalog to find great deals!
              </p>
            </div>
            <Link href="/products" className="btn-primary w-full py-2.5 text-sm inline-flex items-center justify-center gap-2">
              Explore Products <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight">
                  Shopping Cart
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'} in your cart
                </p>
              </div>
              <button
                onClick={handleClearCart}
                disabled={clearing}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <Trash2 size={14} /> Clear entire cart
              </button>
            </div>

            {/* Free Shipping Progress */}
            {amountToFreeShipping > 0 ? (
              <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center gap-3">
                <Truck size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="flex-1 text-xs text-blue-900 dark:text-blue-200">
                  Add <span className="font-bold">{formatINR(amountToFreeShipping)}</span> more to qualify for <span className="font-bold">FREE Express Delivery</span>!
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-3">
                <Truck size={20} className="text-green-600 dark:text-green-400 shrink-0" />
                <div className="text-xs text-green-900 dark:text-green-200 font-medium">
                  🎉 Congratulations! Your order qualifies for <span className="font-bold">FREE Delivery</span>.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Items List */}
              <div className="lg:col-span-8 space-y-4">
                {cart.items.map((item) => {
                  const variant = item.variant
                  const availableStock = variant.inventory?.available_quantity ?? 99
                  const isOutOfStock = availableStock <= 0
                  const hasStockWarning = item.quantity > availableStock
                  const itemImage = variant.product_image || variant.product?.primary_image?.image

                  return (
                    <div 
                      key={item.id} 
                      className="card p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
                    >
                      {/* Product Thumbnail & Details */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
                          {itemImage ? (
                            <img
                              src={getImageUrl(itemImage)}
                              alt={variant.product_name || variant.sku}
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <ShoppingBag size={28} className="text-gray-400" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-semibold text-base text-gray-950 dark:text-white line-clamp-1">
                            {variant.product_name || `Product SKU: ${variant.sku}`}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>SKU: {variant.sku}</span>
                            {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  {Object.entries(variant.attributes)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white pt-0.5">
                            {formatINR(variant.price_paise)} each
                          </div>

                          {hasStockWarning && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertCircle size={13} /> Only {availableStock} in stock. Please reduce quantity.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls & Subtotal */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, -1, availableStock)}
                            disabled={updatingItemId === item.id}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
                            title="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-9 text-center text-xs font-semibold text-gray-900 dark:text-white">
                            {updatingItemId === item.id ? '...' : item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, 1, availableStock)}
                            disabled={updatingItemId === item.id || item.quantity >= availableStock}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
                            title="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Subtotal & Delete */}
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-gray-950 dark:text-white">
                            {formatINR(item.subtotal_paise)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={updatingItemId === item.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Order Summary Sidebar */}
              <div className="lg:col-span-4 sticky top-24">
                <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-5 rounded-2xl shadow-sm">
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800">
                    Order Summary
                  </h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Subtotal ({cart.item_count} items)</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatINR(subtotalPaise)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Estimated Shipping</span>
                      <span>
                        {shippingPaise === 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">FREE</span>
                        ) : (
                          <span className="font-semibold text-gray-900 dark:text-white">{formatINR(shippingPaise)}</span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Estimated GST (18%)</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatINR(taxPaise)}</span>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-baseline">
                      <span className="text-base font-bold text-gray-950 dark:text-white">Estimated Total</span>
                      <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                        {formatINR(grandTotalPaise)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    Proceed to Checkout <ArrowRight size={16} />
                  </Link>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-500" />
                      <span>Safe & Secure 256-bit SSL Checkout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck size={16} className="text-blue-500" />
                      <span>Instant UPI & Cash on Delivery Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RotateCcw size={16} className="text-purple-500" />
                      <span>7-Day Return & Replacement Policy</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
