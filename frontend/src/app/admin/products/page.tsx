'use client'

import { useQuery } from '@tanstack/react-query'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { Product } from '@/types'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, Trash2, AlertCircle, Package } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function AdminProductsPage() {
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery<{ count: number; results: Product[] }>({
    queryKey: ['admin-products', search, filterActive, page],
    queryFn: () => api.get('/admin/products/', {
      params: { search, is_active: filterActive || undefined, page }
    }).then(r => r.data),
  })

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete or deactivate "${name}"? This cannot be undone.`)) return
    try {
      const r = await api.delete(`/admin/products/${id}/`)
      toast.success(r.data.message)
      refetch()
    } catch {
      toast.error('Failed to delete product')
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your product catalog</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field pl-9 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            placeholder="Search products..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="input-field bg-gray-800 border-gray-700 text-white w-full sm:w-40"
          value={filterActive}
          onChange={e => { setFilterActive(e.target.value); setPage(1) }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                {['Product', 'Category', 'SKUs', 'Price From', 'Stock', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && data?.results?.map(product => {
                const totalStock = product.variants.reduce((acc, v) => acc + (v.inventory?.available_quantity || 0), 0)
                return (
                  <tr key={product.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const imgUrl = product.primary_image?.image || product.images?.[0]?.image
                          return imgUrl ? (
                            <img src={getImageUrl(imgUrl)} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500">
                              <AlertCircle size={16} />
                            </div>
                          )
                        })()}
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{product.category_name}</td>
                    <td className="px-4 py-3 text-gray-400">{product.variants.length}</td>
                    <td className="px-4 py-3 text-white font-semibold">
                      {product.min_price ? formatINR(product.min_price) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${totalStock === 0 ? 'bg-red-900/40 text-red-300' : totalStock <= 10 ? 'bg-orange-900/40 text-orange-300' : 'bg-green-900/40 text-green-300'}`}>
                        {totalStock} units
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${product.is_active ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/products/${product.id}`} className="p-1.5 rounded hover:bg-gray-700 text-blue-400" title="View">
                          <Eye size={16} />
                        </Link>
                        <Link href={`/admin/products/${product.id}/edit`} className="p-1.5 rounded hover:bg-gray-700 text-yellow-400" title="Edit">
                          <Pencil size={16} />
                        </Link>
                        <button onClick={() => handleDelete(product.id, product.name)} className="p-1.5 rounded hover:bg-gray-700 text-red-400" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!isLoading && data?.results?.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              <Package size={40} className="mx-auto mb-3 opacity-50" />
              <p>No products found</p>
              <Link href="/admin/products/new" className="mt-3 btn-primary text-sm inline-flex items-center gap-2">
                <Plus size={14} /> Add your first product
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.count > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Total: {data.count} products</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Previous</button>
            <span className="text-sm text-gray-400 py-1.5 px-3">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={data.count <= page * 20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
