'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Truck, CreditCard, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useState } from 'react'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-900/40 text-blue-300', CONFIRMED: 'bg-cyan-900/40 text-cyan-300',
  PROCESSING: 'bg-yellow-900/40 text-yellow-300', SHIPPED: 'bg-purple-900/40 text-purple-300',
  OUT_FOR_DELIVERY: 'bg-orange-900/40 text-orange-300', DELIVERED: 'bg-green-900/40 text-green-300',
  CANCELLED: 'bg-red-900/40 text-red-300', PENDING: 'bg-yellow-900/40 text-yellow-300',
  PAID: 'bg-green-900/40 text-green-300', COLLECTED: 'bg-emerald-900/40 text-emerald-300',
  FAILED: 'bg-red-900/40 text-red-300',
}
const ORDER_STATUSES = ['PLACED','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','RETURNED']
const PAYMENT_STATUSES = ['PENDING','PAID','COLLECTED','FAILED','REFUNDED','CANCELLED']

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [newStatus, setNewStatus] = useState('')
  const [newPayStatus, setNewPayStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [tracking, setTracking] = useState('')
  const [showCODCollect, setShowCODCollect] = useState(false)
  const [codNotes, setCodNotes] = useState('')

  const { data, isLoading } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['admin-order', id],
    queryFn: () => api.get(`/admin/orders/${id}/`).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: (payload: any) => api.patch(`/admin/orders/${id}/status/`, payload).then(r => r.data),
    onSuccess: () => {
      toast.success('Order updated')
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
      setNewStatus(''); setNewPayStatus(''); setNotes(''); setTracking('')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const collectCOD = useMutation({
    mutationFn: (pId: string) => api.post(`/admin/payments/${pId}/collect/`, { notes: codNotes }).then(r => r.data),
    onSuccess: () => {
      toast.success('COD collection recorded')
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
      setShowCODCollect(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  })

  if (isLoading) return (
    <div className="p-8 animate-pulse space-y-4">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-24 bg-gray-800 rounded-xl"/>)}
    </div>
  )

  const order = data?.data
  if (!order) return <div className="p-8 text-red-400">Order not found.</div>

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/orders" className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"><ArrowLeft size={20}/></Link>
        <div>
          <h1 className="text-xl font-bold text-white">Order {order.order_number}</h1>
          <p className="text-gray-400 text-sm">{format(new Date(order.created_at), 'dd MMMM yyyy, hh:mm a')}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
          <span className={`badge ${STATUS_COLORS[order.payment_status]}`}>{order.payment_status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: order details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Order Items</h2>
            <div className="space-y-3">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-white font-medium">{item.product_name}</p>
                    <p className="text-gray-400 text-xs font-mono">{item.sku}</p>
                    {Object.keys(item.variant_attributes||{}).length > 0 && (
                      <p className="text-gray-500 text-xs">{Object.entries(item.variant_attributes).map(([k,v])=>`${k}: ${v}`).join(', ')}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-white">{formatINR(item.unit_price_paise)} × {item.quantity}</p>
                    <p className="text-gray-300 font-semibold">{formatINR(item.total_paise)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-700 space-y-1">
              <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span>{formatINR(order.subtotal_paise)}</span></div>
              <div className="flex justify-between text-sm text-gray-400"><span>Shipping</span><span>{formatINR(order.shipping_paise)}</span></div>
              <div className="flex justify-between text-sm text-gray-400"><span>Tax (GST)</span><span>{formatINR(order.tax_paise)}</span></div>
              {order.discount_paise > 0 && <div className="flex justify-between text-sm text-green-400"><span>Discount</span><span>-{formatINR(order.discount_paise)}</span></div>}
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-gray-700"><span>Total</span><span>{formatINR(order.total_paise)}</span></div>
            </div>
          </div>

          {/* Status History */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Clock size={16}/>Status History</h2>
            <div className="space-y-3">
              {order.status_history?.map((h: any) => (
                <div key={h.id} className="flex gap-3 text-sm">
                  <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0"/>
                  <div>
                    <p className="text-white">{h.from_status ? `${h.from_status} → ${h.to_status}` : `Placed as ${h.to_status}`}</p>
                    {h.notes && <p className="text-gray-500 text-xs">{h.notes}</p>}
                    <p className="text-gray-600 text-xs">{format(new Date(h.created_at), 'dd MMM yyyy, hh:mm a')}{h.changed_by_email && ` by ${h.changed_by_email}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: actions + info */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Customer</h2>
            <p className="text-white">{order.customer_name}</p>
            <p className="text-gray-400 text-sm">{order.customer_email}</p>
            {order.customer_phone && <p className="text-gray-400 text-sm">{order.customer_phone}</p>}
          </div>

          {/* Delivery Address */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2"><MapPin size={16}/>Delivery Address</h2>
            {order.shipping_address_snapshot && (
              <div className="text-sm text-gray-300 space-y-0.5">
                <p className="font-medium text-white">{order.shipping_address_snapshot.full_name}</p>
                <p>{order.shipping_address_snapshot.phone}</p>
                <p>{order.shipping_address_snapshot.address_line1}</p>
                {order.shipping_address_snapshot.address_line2 && <p>{order.shipping_address_snapshot.address_line2}</p>}
                <p>{order.shipping_address_snapshot.city}, {order.shipping_address_snapshot.state} — {order.shipping_address_snapshot.pincode}</p>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2"><CreditCard size={16}/>Payment</h2>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="text-white font-medium">{order.payment_method}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`badge ${STATUS_COLORS[order.payment_status]}`}>{order.payment_status}</span></div>
            </div>

            {/* COD Collection */}
            {order.payment_method === 'COD' && order.payment_status === 'PENDING' && (
              <div className="mt-4">
                {!showCODCollect ? (
                  <button onClick={() => setShowCODCollect(true)} className="w-full btn-primary text-sm py-2">
                    Record Cash Collection
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea className="input-field bg-gray-800 border-gray-700 text-white text-sm h-16 resize-none"
                      placeholder="Notes (optional)" value={codNotes} onChange={e => setCodNotes(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => {
                        if (order.payment) collectCOD.mutate(order.payment.id)
                        else toast.error('Payment record not found')
                      }} className="btn-primary text-sm flex-1" disabled={collectCOD.isPending}>
                        {collectCOD.isPending ? 'Recording...' : 'Confirm Collection'}
                      </button>
                      <button onClick={() => setShowCODCollect(false)} className="btn-secondary text-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Update Status */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2"><Truck size={16}/>Update Order</h2>
            <div className="space-y-3">
              <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={newStatus}
                onChange={e => setNewStatus(e.target.value)}>
                <option value="">Change order status...</option>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={newPayStatus}
                onChange={e => setNewPayStatus(e.target.value)}>
                <option value="">Change payment status...</option>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="input-field bg-gray-800 border-gray-700 text-white text-sm"
                placeholder="Tracking number (optional)" value={tracking} onChange={e => setTracking(e.target.value)} />
              <textarea className="input-field bg-gray-800 border-gray-700 text-white text-sm h-16 resize-none"
                placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              <button onClick={() => updateStatus.mutate({
                status: newStatus || undefined, payment_status: newPayStatus || undefined,
                notes, tracking_number: tracking || undefined
              })} disabled={updateStatus.isPending || (!newStatus && !newPayStatus)}
                className="w-full btn-primary text-sm disabled:opacity-40">
                {updateStatus.isPending ? 'Updating...' : 'Update Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
