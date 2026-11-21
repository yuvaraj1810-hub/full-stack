'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { useState } from 'react'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-900/40 text-blue-300', CONFIRMED: 'bg-cyan-900/40 text-cyan-300',
  DELIVERED: 'bg-green-900/40 text-green-300', CANCELLED: 'bg-red-900/40 text-red-300',
  PENDING: 'bg-yellow-900/40 text-yellow-300', PAID: 'bg-green-900/40 text-green-300',
  COLLECTED: 'bg-emerald-900/40 text-emerald-300', FAILED: 'bg-red-900/40 text-red-300',
}

export default function AdminOrderHistoryPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ count: number; results: any[] }>({
    queryKey: ['admin-history', search, status, paymentMethod, dateFrom, dateTo, page],
    queryFn: () => api.get('/admin/orders/history/', {
      params: { search, status: status || undefined, payment_method: paymentMethod || undefined,
        date_from: dateFrom || undefined, date_to: dateTo || undefined, page }
    }).then(r => r.data),
  })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order History</h1>
        <p className="text-gray-400 text-sm mt-1">Complete historical record — never permanently deleted</p>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative sm:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input-field pl-9 bg-gray-800 border-gray-700 text-white text-sm"
            placeholder="Order # or customer..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm" value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {['PLACED','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','RETURNED'].map(s=><option key={s} value={s}>{s}</option>)}
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

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['Order #','Customer','Items','Total','Method','Payment Status','Order Status','Date','View'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({length:8}).map((_,i)=>(
                <tr key={i} className="animate-pulse">{Array.from({length:9}).map((_,j)=>(
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded"/></td>
                ))}</tr>
              ))}
              {!isLoading && data?.results?.map((o:any) => (
                <tr key={o.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{o.order_number}</td>
                  <td className="px-4 py-3">
                    <div className="text-white text-sm">{o.customer_name}</div>
                    <div className="text-gray-500 text-xs">{o.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{o.items?.length || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-white">{formatINR(o.total_paise)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${o.payment_method==='COD'?'bg-indigo-900/40 text-indigo-300':'bg-violet-900/40 text-violet-300'}`}>{o.payment_method}</span>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[o.payment_status]||'bg-gray-700 text-gray-300'}`}>{o.payment_status}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[o.status]||'bg-gray-700 text-gray-300'}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{format(new Date(o.created_at),'dd MMM yy')}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-blue-400 hover:text-blue-300 text-xs">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !data?.results?.length && (
            <div className="p-10 text-center text-gray-500">No order history found.</div>
          )}
        </div>
      </div>

      {data && data.count > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{data.count} orders total</p>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-400 py-1.5 px-3">Page {page}</span>
            <button onClick={()=>setPage(p=>p+1)} disabled={data.count<=page*20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
