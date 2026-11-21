'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, formatINR } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Package } from 'lucide-react'

interface VariantForm {
  sku: string
  price_paise: string
  original_price_paise: string
  stock_quantity: string
  attributes: { key: string; value: string }[]
}

const emptyVariant = (): VariantForm => ({
  sku: '', price_paise: '', original_price_paise: '', stock_quantity: '',
  attributes: [{ key: '', value: '' }],
})

export default function AddProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant()])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories/').then(r => r.data),
  })

  const createProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name, description, category_id: parseInt(categoryId), is_active: isActive,
        variants: variants.map(v => ({
          sku: v.sku,
          price_paise: Math.round(parseFloat(v.price_paise) * 100),
          original_price_paise: v.original_price_paise ? Math.round(parseFloat(v.original_price_paise) * 100) : null,
          stock_quantity: parseInt(v.stock_quantity),
          attributes: Object.fromEntries(
            v.attributes.filter(a => a.key.trim()).map(a => [a.key.trim(), a.value.trim()])
          ),
        })),
      }
      const { data } = await api.post('/admin/products/', payload)
      const productId = data.data.id

      // Upload images if any
      if (imageFiles.length > 0) {
        const form = new FormData()
        imageFiles.forEach(f => form.append('images', f))
        await api.post(`/admin/products/${productId}/images/`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      return data
    },
    onSuccess: (data) => {
      toast.success('Product created successfully!')
      router.push('/admin/products')
    },
    onError: (err: any) => {
      const detail = err.response?.data
      if (detail && typeof detail === 'object') {
        const flat: Record<string, string> = {}
        const flatten = (obj: any, prefix = '') => {
          Object.entries(obj).forEach(([k, v]) => {
            const key = prefix ? `${prefix}.${k}` : k
            if (Array.isArray(v)) flat[key] = v.join(', ')
            else if (typeof v === 'object' && v !== null) flatten(v, key)
            else flat[key] = String(v)
          })
        }
        flatten(detail)
        setErrors(flat)
        toast.error('Please fix validation errors')
      } else {
        toast.error('Failed to create product')
      }
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Product name is required'
    if (!categoryId) e.category_id = 'Category is required'
    variants.forEach((v, i) => {
      if (!v.sku.trim()) e[`v${i}_sku`] = 'SKU required'
      if (!v.price_paise || isNaN(parseFloat(v.price_paise)) || parseFloat(v.price_paise) <= 0)
        e[`v${i}_price`] = 'Valid price required'
      if (!v.stock_quantity || isNaN(parseInt(v.stock_quantity)) || parseInt(v.stock_quantity) < 0)
        e[`v${i}_stock`] = 'Valid stock required'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) createProduct.mutate()
  }

  const updateVariant = (i: number, field: keyof VariantForm, value: any) => {
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  const updateAttribute = (vi: number, ai: number, field: 'key' | 'value', val: string) => {
    setVariants(vs => vs.map((v, i) => i === vi ? {
      ...v,
      attributes: v.attributes.map((a, j) => j === ai ? { ...a, [field]: val } : a)
    } : v))
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Add New Product</h1>
        <p className="text-gray-400 text-sm mt-1">Create a product that will appear on the storefront</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-3">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Name *</label>
            <input className="input-field bg-gray-800 border-gray-600 text-white" value={name}
              onChange={e => setName(e.target.value)} placeholder="e.g. Wireless Bluetooth Headphones" />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea className="input-field bg-gray-800 border-gray-600 text-white h-28 resize-y"
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the product features, materials, dimensions..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category *</label>
              <select className="input-field bg-gray-800 border-gray-600 text-white" value={categoryId}
                onChange={e => setCategoryId(e.target.value)}>
                <option value="">Select a category</option>
                {cats?.results?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-red-400 text-xs mt-1">{errors.category_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Status</label>
              <div className="flex items-center gap-3 mt-3">
                <button type="button" onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-300">{isActive ? 'Active (visible on store)' : 'Inactive (hidden)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Images */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-3">Product Images</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Upload Images</label>
            <input type="file" accept="image/*" multiple className="block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white
              hover:file:bg-blue-700 cursor-pointer"
              onChange={e => setImageFiles(Array.from(e.target.files || []))} />
            {imageFiles.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {imageFiles.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(f)} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-600" />
                    {i === 0 && <span className="absolute top-0 left-0 bg-blue-600 text-white text-xs px-1 rounded-tl-lg rounded-br-lg">Primary</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Variants */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-700 pb-3">
            <h2 className="text-lg font-semibold text-white">Variants & Pricing</h2>
            <button type="button" onClick={() => setVariants(vs => [...vs, emptyVariant()])}
              className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5">
              <Plus size={14} /> Add Variant
            </button>
          </div>

          {variants.map((v, vi) => (
            <div key={vi} className="border border-gray-700 rounded-xl p-5 space-y-4 relative">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Variant {vi + 1}</h3>
                {variants.length > 1 && (
                  <button type="button" onClick={() => setVariants(vs => vs.filter((_, i) => i !== vi))}
                    className="p-1.5 rounded hover:bg-red-900/30 text-red-400">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">SKU *</label>
                  <input className="input-field bg-gray-800 border-gray-600 text-white text-sm"
                    value={v.sku} onChange={e => updateVariant(vi, 'sku', e.target.value)}
                    placeholder="CM-PRODUCT-001" />
                  {errors[`v${vi}_sku`] && <p className="text-red-400 text-xs mt-1">{errors[`v${vi}_sku`]}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Selling Price (₹) *</label>
                  <input type="number" step="0.01" min="0" className="input-field bg-gray-800 border-gray-600 text-white text-sm"
                    value={v.price_paise} onChange={e => updateVariant(vi, 'price_paise', e.target.value)}
                    placeholder="1999.00" />
                  {errors[`v${vi}_price`] && <p className="text-red-400 text-xs mt-1">{errors[`v${vi}_price`]}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">MRP (₹) — optional</label>
                  <input type="number" step="0.01" min="0" className="input-field bg-gray-800 border-gray-600 text-white text-sm"
                    value={v.original_price_paise} onChange={e => updateVariant(vi, 'original_price_paise', e.target.value)}
                    placeholder="2999.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Stock Quantity *</label>
                  <input type="number" min="0" className="input-field bg-gray-800 border-gray-600 text-white text-sm"
                    value={v.stock_quantity} onChange={e => updateVariant(vi, 'stock_quantity', e.target.value)}
                    placeholder="100" />
                  {errors[`v${vi}_stock`] && <p className="text-red-400 text-xs mt-1">{errors[`v${vi}_stock`]}</p>}
                </div>
              </div>

              {/* Attributes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">Attributes (e.g. Color, Size)</label>
                  <button type="button" onClick={() => updateVariant(vi, 'attributes', [...v.attributes, { key: '', value: '' }])}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Plus size={12} /> Add attribute
                  </button>
                </div>
                {v.attributes.map((attr, ai) => (
                  <div key={ai} className="flex gap-2 mb-2">
                    <input className="input-field bg-gray-800 border-gray-600 text-white text-sm flex-1"
                      placeholder="Key (e.g. Color)" value={attr.key}
                      onChange={e => updateAttribute(vi, ai, 'key', e.target.value)} />
                    <input className="input-field bg-gray-800 border-gray-600 text-white text-sm flex-1"
                      placeholder="Value (e.g. Black)" value={attr.value}
                      onChange={e => updateAttribute(vi, ai, 'value', e.target.value)} />
                    {v.attributes.length > 1 && (
                      <button type="button" onClick={() => updateVariant(vi, 'attributes', v.attributes.filter((_, j) => j !== ai))}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={createProduct.isPending}
            className="btn-primary flex items-center gap-2 px-6">
            <Package size={16} />
            {createProduct.isPending ? 'Creating...' : 'Create Product'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
