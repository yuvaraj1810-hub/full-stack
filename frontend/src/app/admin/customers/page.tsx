'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { format } from 'date-fns'

export default function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ count: number; results: any[] }>({
    queryKey: ['admin-customers', search, page],
    queryFn: () => api.get('/admin/customers/', { params: { search: search||undefined, page } }).then(r => r.data),
  })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customers</h1>
        <p className="text-gray-400 text-sm mt-1">Registered CloudMart customers</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input-field pl-9 bg-gray-800 border-gray-700 text-white text-sm"
          placeholder="Search by name, email, phone..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['#','Name','Email','Phone','Orders','Status','Joined'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({length:8}).map((_,i) => (
                <tr key={i} className="animate-pulse">{Array.from({length:7}).map((_,j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded"/></td>
                ))}</tr>
              ))}
              {!isLoading && data?.results?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.id}</td>
                  <td className="px-4 py-3 text-white font-medium">{c.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.email}</td>
                  <td className="px-4 py-3 text-gray-400">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.order_count}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${c.is_active ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{format(new Date(c.date_joined),'dd MMM yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !data?.results?.length && (
            <div className="p-10 text-center text-gray-500">
              <Users size={40} className="mx-auto mb-3 opacity-50"/>
              <p>No customers found.</p>
            </div>
          )}
        </div>
      </div>

      {data && data.count > 20 && (
        <div className="flex gap-2 justify-end">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-400 py-1.5 px-3">Page {page} of {Math.ceil(data.count/20)}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={data.count<=page*20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
