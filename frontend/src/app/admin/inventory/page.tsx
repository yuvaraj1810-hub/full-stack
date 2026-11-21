'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { toast } from 'sonner'
import { useState } from 'react'

export default function AdminInventoryPage() {
  const qc = useQueryClient()
  const [adjustVariantId, setAdjustVariantId] = useState<number|null>(null)
  const [newQty, setNewQty] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => api.get('/admin/products/', { params: { page_size: 100 } }).then(r => r.data),
  })

  const adjust = useMutation({
    mutationFn: ({ variantId, quantity, notes }: any) =>
      api.patch(`/admin/inventory/${variantId}/adjust/`, { quantity, notes }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Stock adjusted: ${data.data.sku} → ${data.data.quantity} units`)
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      setAdjustVariantId(null); setNewQty(''); setNotes('')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Adjustment failed'),
  })

  const allVariants = data?.results?.flatMap((p: any) =>
    p.variants.map((v: any) => ({ ...v, productName: p.name, productId: p.id }))
  ) || []

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Inventory</h1>
        <p className="text-gray-400 text-sm mt-1">Monitor and adjust stock levels</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['Product','SKU','Attributes','Total Stock','Reserved','Available','Status','Adjust'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({length:6}).map((_,i) => (
                <tr key={i} className="animate-pulse">{Array.from({length:8}).map((_,j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded"/></td>
                ))}</tr>
              ))}
              {!isLoading && allVariants.map((v: any) => {
                const inv = v.inventory
                const isLow = inv && inv.available_quantity <= inv.low_stock_threshold
                const isOos = inv && inv.available_quantity === 0
                return (
                  <tr key={v.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-white text-sm">{v.productName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{v.sku}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{Object.entries(v.attributes||{}).map(([k,val])=>`${k}: ${val}`).join(', ')||'—'}</td>
                    <td className="px-4 py-3 text-white">{inv?.quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-yellow-400">{inv?.reserved_quantity ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">{inv?.available_quantity ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${isOos ? 'bg-red-900/40 text-red-300' : isLow ? 'bg-orange-900/40 text-orange-300' : 'bg-green-900/40 text-green-300'}`}>
                        {isOos ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setAdjustVariantId(v.id); setNewQty(String(inv?.quantity||0)) }}
                        className="text-xs text-blue-400 hover:text-blue-300 border border-blue-700 rounded px-2 py-1">
                        Adjust
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustVariantId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Adjust Stock</h2>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">New Quantity</label>
              <input type="number" min="0" className="input-field bg-gray-800 border-gray-700 text-white"
                value={newQty} onChange={e => setNewQty(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Notes</label>
              <input className="input-field bg-gray-800 border-gray-700 text-white"
                placeholder="Reason for adjustment..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => adjust.mutate({ variantId: adjustVariantId, quantity: parseInt(newQty), notes })}
                disabled={adjust.isPending || !newQty}
                className="btn-primary flex-1 text-sm disabled:opacity-40">
                {adjust.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setAdjustVariantId(null)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
