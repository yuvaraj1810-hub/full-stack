'use client'
import { useQuery } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

export default function AdminPaymentsPage() {
  const [method, setMethod] = useState('')
  const [pstatus, setPstatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ count: number; results: any[] }>({
    queryKey: ['admin-payments', method, pstatus, page],
    queryFn: () => api.get('/admin/payments/', { params: { method: method||undefined, status: pstatus||undefined, page } }).then(r => r.data),
  })

  const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-yellow-900/40 text-yellow-300', PAID: 'bg-green-900/40 text-green-300',
    COLLECTED: 'bg-emerald-900/40 text-emerald-300', FAILED: 'bg-red-900/40 text-red-300',
    CANCELLED: 'bg-gray-700 text-gray-400', REFUNDED: 'bg-pink-900/40 text-pink-300',
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-gray-400 text-sm mt-1">View all payment records</p>
      </div>

      <div className="flex gap-3">
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm w-40" value={method}
          onChange={e => { setMethod(e.target.value); setPage(1) }}>
          <option value="">All Methods</option>
          <option value="COD">COD</option>
          <option value="UPI">UPI</option>
        </select>
        <select className="input-field bg-gray-800 border-gray-700 text-white text-sm w-48" value={pstatus}
          onChange={e => { setPstatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {['PENDING','PAID','COLLECTED','FAILED','REFUNDED','CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['Payment ID','Order #','Customer','Method','Amount','Status','Dev Sim','Collected By','Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({length:6}).map((_,i) => (
                <tr key={i} className="animate-pulse">{Array.from({length:9}).map((_,j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded"/></td>
                ))}</tr>
              ))}
              {!isLoading && data?.results?.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.id.slice(0,8)}…</td>
                  <td className="px-4 py-3 text-blue-400 text-xs font-mono">{p.order_number}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{p.customer_email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.payment_method==='COD'?'bg-indigo-900/40 text-indigo-300':'bg-violet-900/40 text-violet-300'}`}>{p.payment_method}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">{formatINR(p.amount_paise)}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[p.status]||'bg-gray-700 text-gray-300'}`}>{p.status}</span></td>
                  <td className="px-4 py-3">{p.dev_simulation ? <span className="badge bg-orange-900/40 text-orange-300">DEV</span> : '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.collected_by || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{format(new Date(p.created_at),'dd MMM yy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !data?.results?.length && (
            <div className="p-10 text-center text-gray-500">No payments found.</div>
          )}
        </div>
      </div>

      {data && data.count > 20 && (
        <div className="flex gap-2 justify-end">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-400 py-1.5 px-3">Page {page}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={data.count<=page*20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
