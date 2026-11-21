'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { Order } from '@/types'
import { useState } from 'react'
import { Search, Eye, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-900/40 text-blue-300', CONFIRMED: 'bg-cyan-900/40 text-cyan-300',
  PROCESSING: 'bg-yellow-900/40 text-yellow-300', SHIPPED: 'bg-purple-900/40 text-purple-300',
  OUT_FOR_DELIVERY: 'bg-orange-900/40 text-orange-300', DELIVERED: 'bg-green-900/40 text-green-300',
  CANCELLED: 'bg-red-900/40 text-red-300', RETURNED: 'bg-pink-900/40 text-pink-300',
  PENDING: 'bg-yellow-900/40 text-yellow-300', PAID: 'bg-green-900/40 text-green-300',
  COLLECTED: 'bg-emerald-900/40 text-emerald-300', FAILED: 'bg-red-900/40 text-red-300',
}

const ORDER_STATUSES = ['PLACED','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','RETURNED']
const PAYMENT_STATUSES = ['PENDING','PAID','COLLECTED','FAILED','REFUNDED','CANCELLED']

export default function AdminOrdersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery<{ count: number; results: any[] }>({
    queryKey: ['admin-orders', search, status, paymentStatus, paymentMethod, dateFrom, dateTo, page],
    queryFn: () => api.get('/admin/orders/', {
      params: { search, status: status || undefined, payment_status: paymentStatus || undefined,
        payment_method: paymentMethod || undefined, date_from: dateFrom || undefined,
        date_to: dateTo || undefined, page }
    }).then(r => r.data),
  })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <p className="text-gray-400 text-sm mt-1">Manage all CloudMart orders</p>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="relative xl:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9 bg-gray-800 border-gray-700 text-white placeholder-gray-500 text-sm"
            placeholder="Order # or customer..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={paymentStatus}
          onChange={e => { setPaymentStatus(e.target.value); setPage(1) }}>
          <option value="">All Payment Status</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={paymentMethod}
          onChange={e => { setPaymentMethod(e.target.value); setPage(1) }}>
          <option value="">All Methods</option>
          <option value="COD">COD</option>
          <option value="UPI">UPI</option>
        </select>
        <input type="date" className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['Order #','Customer','Items','Total','Method','Payment','Status','Date','Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({length: 6}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length: 9}).map((_,j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded"/></td>
                  ))}
                </tr>
              ))}
              {!isLoading && data?.results?.map(order => (
                <tr key={order.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{order.order_number}</td>
                  <td className="px-4 py-3">
                    <div className="text-white text-sm">{order.customer_name}</div>
                    <div className="text-gray-500 text-xs">{order.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{order.item_count}</td>
                  <td className="px-4 py-3 font-semibold text-white">{formatINR(order.total_paise)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${order.payment_method === 'COD' ? 'bg-indigo-900/40 text-indigo-300' : 'bg-violet-900/40 text-violet-300'}`}>
                      {order.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[order.payment_status] || 'bg-gray-700 text-gray-300'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[order.status] || 'bg-gray-700 text-gray-300'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {format(new Date(order.created_at), 'dd MMM yy')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="p-1.5 rounded hover:bg-gray-700 text-blue-400 inline-block">
                      <Eye size={16}/>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !data?.results?.length && (
            <div className="p-10 text-center text-gray-500">No orders found.</div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.count > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{data.count} total orders</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-400 py-1.5 px-3">Page {page}</span>
            <button onClick={() => setPage(p => p+1)} disabled={data.count <= page*20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
