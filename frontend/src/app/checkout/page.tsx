'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { 
  ShieldCheck, 
  Truck, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Plus, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  ArrowRight,
  ShoppingBag,
  Clock,
  Sparkles
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { useAuthStore, useCartStore } from '@/lib/store'
import { Address, Cart, Order } from '@/types'
import { toast } from 'sonner'

export default function CheckoutPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const { cart, fetchCart, clearCart } = useCartStore()

  // State
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>('COD')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)

  // New address form state
  const [newAddress, setNewAddress] = useState({
    label: 'HOME',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    is_default: true,
  })
  const [savingAddress, setSavingAddress] = useState(false)

  // UPI Simulation State
  const [upiOrderData, setUpiOrderData] = useState<{
    order_number: string
    order_id: number
    payment_id: string
    total_paise: number
  } | null>(null)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)

  // Final Placed Order (Confirmation View)
  const [completedOrder, setCompletedOrder] = useState<any | null>(null)
  const [failedReason, setFailedReason] = useState<string | null>(null)

  // Fetch Cart & Addresses
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?next=/checkout')
      return
    }
    fetchCart().catch(() => {})
  }, [isAuthenticated, fetchCart, router])

  // Fetch Addresses
  const { data: addressData, refetch: refetchAddresses } = useQuery<{ results: Address[] } | Address[]>({
    queryKey: ['user-addresses'],
    queryFn: () => api.get('/addresses/').then(res => res.data),
    enabled: isAuthenticated,
  })

  const addresses: Address[] = Array.isArray(addressData) 
    ? addressData 
    : addressData?.results || []

  // Auto-select default address
  useEffect(() => {
    if (addresses.length > 0 && selectedAddressId === null) {
      const defaultAddr = addresses.find(a => a.is_default) || addresses[0]
      setSelectedAddressId(defaultAddr.id)
    }
  }, [addresses, selectedAddressId])

  // Pricing
  const subtotalPaise = cart?.total_paise || 0
  const freeShippingThresholdPaise = 49900
  const shippingPaise = subtotalPaise === 0 || subtotalPaise >= freeShippingThresholdPaise ? 0 : 4900
  const taxPaise = Math.round(subtotalPaise * 0.18)
  const grandTotalPaise = subtotalPaise + shippingPaise + taxPaise

  // Add Address Handler
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAddress.full_name || !newAddress.phone || !newAddress.address_line1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
      toast.error('Please fill in all required address fields.')
      return
    }

    try {
      setSavingAddress(true)
      const res = await api.post('/addresses/', newAddress)
      toast.success('Address saved!')
      setShowAddressModal(false)
      await refetchAddresses()
      setSelectedAddressId(res.data.id)
      setNewAddress({
        label: 'HOME',
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        is_default: true,
      })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not save address')
    } finally {
      setSavingAddress(false)
    }
  }

  // Place Order Handler
  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast.error('Please select or add a shipping address.')
      return
    }

    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty.')
      return
    }

    setIsPlacingOrder(true)
    setFailedReason(null)

    if (paymentMethod === 'COD') {
      try {
        const res = await api.post('/checkout/cod/', {
          shipping_address_id: selectedAddressId,
          payment_method: 'COD',
        })

        if (res.data.success) {
          toast.success('Order placed successfully via Cash on Delivery!')
          setCompletedOrder({
            order_number: res.data.order_number,
            order_id: res.data.order_id,
            payment_method: 'COD',
            payment_status: 'PENDING',
            order_status: 'PLACED',
            total_paise: res.data.total_paise,
          })
          await fetchCart().catch(() => {})
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Failed to place order. Please check stock.'
        toast.error(msg)
        setFailedReason(msg)
      } finally {
        setIsPlacingOrder(false)
      }
    } else {
      // UPI Checkout
      try {
        const res = await api.post('/checkout/upi/', {
          shipping_address_id: selectedAddressId,
          payment_method: 'UPI',
        })

        if (res.data.success) {
          setUpiOrderData({
            order_number: res.data.order_number,
            order_id: res.data.order_id,
            payment_id: res.data.payment_id,
            total_paise: res.data.total_paise,
          })
          toast.info('UPI order created. Please complete simulated payment.')
          await fetchCart().catch(() => {})
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Failed to initialize UPI order. Please check stock.'
        toast.error(msg)
        setFailedReason(msg)
      } finally {
        setIsPlacingOrder(false)
      }
    }
  }

  // Dev UPI Simulation Outcome Handler
  const handleSimulateUPIOutcome = async (outcome: 'success' | 'failure' | 'cancelled') => {
    if (!upiOrderData) return

    try {
      setIsSimulatingPayment(true)
      const res = await api.post('/payments/dev-upi/simulate/', {
        payment_id: upiOrderData.payment_id,
        outcome: outcome,
      })

      if (outcome === 'success') {
        toast.success('Simulated payment successful! Order confirmed.')
        setCompletedOrder({
          order_number: upiOrderData.order_number,
          order_id: upiOrderData.order_id,
          payment_method: 'UPI',
          payment_status: 'PAID',
          order_status: 'CONFIRMED',
          total_paise: upiOrderData.total_paise,
        })
        setUpiOrderData(null)
      } else if (outcome === 'failure') {
        toast.error('Simulated UPI payment failed. Reserved inventory released.')
        setFailedReason(`Simulated payment failed (Declined by bank). Order #${upiOrderData.order_number}`)
        setUpiOrderData(null)
      } else {
        toast.info('Simulated UPI payment was cancelled.')
        setFailedReason(`Simulated payment cancelled by user. Order #${upiOrderData.order_number}`)
        setUpiOrderData(null)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to simulate UPI response')
    } finally {
      setIsSimulatingPayment(false)
    }
  }

  // ── Render 1: Order Confirmation Screen ──
  if (completedOrder) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="card max-w-lg w-full p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl rounded-2xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto">
              <CheckCircle size={36} />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-950 dark:text-white">Order Confirmed!</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Thank you for your purchase. We are getting your order ready.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Order Number:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {completedOrder.order_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Payment Method:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {completedOrder.payment_method === 'COD' ? 'Cash on Delivery' : 'UPI (Simulated)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Payment Status:</span>
                <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                  {completedOrder.payment_status}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white font-medium">Total Amount:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatINR(completedOrder.total_paise)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/account/orders"
                className="btn-primary flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-2"
              >
                View My Orders <ArrowRight size={16} />
              </Link>
              <Link
                href="/products"
                className="btn-secondary flex-1 py-2.5 text-sm inline-flex items-center justify-center"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <span>/</span>
          <Link href="/cart" className="hover:text-blue-600 dark:hover:text-blue-400">Cart</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">Checkout</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight">
            Checkout
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete your order with secure shipping and payment options
          </p>
        </div>

        {/* Failed Banner */}
        {failedReason && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between text-sm text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{failedReason}</span>
            </div>
            <button onClick={() => setFailedReason(null)} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Checkout Steps */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Delivery Address */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Delivery Address</h2>
                </div>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add New Address
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <MapPin className="mx-auto text-gray-400" size={32} />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You have no saved addresses yet. Please add a shipping address.
                  </p>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    Add Shipping Address
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-4 rounded-xl border text-sm cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-900/20 ring-1 ring-blue-600'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {addr.full_name}
                            <span className="badge bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-300">
                              {addr.label}
                            </span>
                          </span>
                          {isSelected && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {addr.address_line1}
                          {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                          <br />
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Phone: {addr.phone}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Payment Method */}
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">Payment Method</h2>
              </div>

              <div className="space-y-3">
                {/* Cash on Delivery */}
                <label
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-900/20 ring-1 ring-blue-600'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shrink-0">
                    <Banknote size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">Cash on Delivery (COD)</span>
                      <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px]">
                        Popular
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Pay cash at your doorstep when your shipment arrives.
                    </p>
                  </div>
                </label>

                {/* Development UPI Simulation */}
                <label
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-900/20 ring-1 ring-blue-600'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="UPI"
                    checked={paymentMethod === 'UPI'}
                    onChange={() => setPaymentMethod('UPI')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shrink-0">
                    <QrCode size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">UPI (Dev Simulation)</span>
                      <span className="badge bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px]">
                        Simulator Mode
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Simulate real-time UPI success, failure, or cancellation without actual charges.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Sidebar Order Summary */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-gray-950 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800">
                Order Review
              </h2>

              {/* Items Preview */}
              <div className="max-h-56 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 flex-1 pr-2">
                      <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-[10px]">
                        {item.quantity}×
                      </span>
                      <span className="text-gray-800 dark:text-gray-200 truncate">
                        {item.variant.product_name || item.variant.sku}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatINR(item.subtotal_paise)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatINR(subtotalPaise)}</span>
                </div>

                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span>
                    {shippingPaise === 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-semibold">FREE</span>
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-white">{formatINR(shippingPaise)}</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>GST (18%)</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatINR(taxPaise)}</span>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-baseline">
                  <span className="text-base font-bold text-gray-950 dark:text-white">Grand Total</span>
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                    {formatINR(grandTotalPaise)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || !selectedAddressId || !cart || cart.items.length === 0}
                className="btn-primary w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isPlacingOrder ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Confirm & Place Order <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-green-500" />
                <span>Verified CloudMart Stock Reservation</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Modal 1: Add New Address ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Delivery Address</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Address Type
                  </label>
                  <select
                    value={newAddress.label}
                    onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                    className="input-field text-sm"
                  >
                    <option value="HOME">Home</option>
                    <option value="WORK">Work</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Aditi Sharma"
                    value={newAddress.full_name}
                    onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Flat, House No., Building *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Flat 402, Lotus Towers"
                  value={newAddress.address_line1}
                  onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Area, Colony, Sector, Street
                </label>
                <input
                  type="text"
                  placeholder="Near Cyber City"
                  value={newAddress.address_line2}
                  onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Bengaluru"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Karnataka"
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="560001"
                    value={newAddress.pincode}
                    onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="btn-primary flex-1 py-2 text-sm font-semibold"
                >
                  {savingAddress ? 'Saving...' : 'Save & Deliver Here'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="btn-secondary py-2 px-4 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Development UPI Simulation ── */}
      {upiOrderData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl space-y-5 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              <Sparkles size={14} /> Development UPI Simulator
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Complete UPI Payment</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Order <span className="font-mono font-bold">{upiOrderData.order_number}</span> is awaiting payment confirmation.
              </p>
            </div>

            {/* QR / VPA Mock Box */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="w-32 h-32 mx-auto bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <QrCode size={110} className="text-gray-900 dark:text-gray-100" />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                VPA: <span className="font-bold text-blue-600 dark:text-blue-400">cloudmart@upi</span>
              </div>
              <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                {formatINR(upiOrderData.total_paise)}
              </div>
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              * This is a local sandbox test environment. No real funds will be deducted.
            </p>

            {/* Simulation Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSimulatingPayment}
                onClick={() => handleSimulateUPIOutcome('success')}
                className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle size={15} /> Simulate Payment Success (Approve)
              </button>

              <button
                type="button"
                disabled={isSimulatingPayment}
                onClick={() => handleSimulateUPIOutcome('failure')}
                className="btn-secondary w-full py-2 text-xs font-semibold flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <XCircle size={15} /> Simulate Payment Failure (Decline)
              </button>

              <button
                type="button"
                disabled={isSimulatingPayment}
                onClick={() => handleSimulateUPIOutcome('cancelled')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pt-1"
              >
                Cancel Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
