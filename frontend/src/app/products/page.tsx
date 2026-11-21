'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  ShoppingBag, 
  Plus, 
  Check, 
  AlertCircle, 
  ArrowUpDown, 
  SlidersHorizontal,
  X,
  Package,
  Sparkles
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { Product, Category, PaginatedResponse } from '@/types'
import { useCartStore, useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

function ProductsCatalog() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialSearch = searchParams.get('search') || ''
  const initialCategory = searchParams.get('category') ? Number(searchParams.get('category')) : null

  const [search, setSearch] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(initialCategory)
  const [sortBy, setSortBy] = useState<string>('default')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [addingVariantId, setAddingVariantId] = useState<number | null>(null)

  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  // Update state if searchParams change
  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setSelectedCategory(searchParams.get('category') ? Number(searchParams.get('category')) : null)
  }, [searchParams])

  // Fetch Categories
  const { data: categoriesData } = useQuery<{ results: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories/').then(res => res.data),
  })

  // Fetch Products
  const { data: productsData, isLoading, isError, refetch } = useQuery<PaginatedResponse<Product>>({
    queryKey: ['products-catalog', selectedCategory, search],
    queryFn: () => api.get('/products/', {
      params: {
        category: selectedCategory || undefined,
        search: search.trim() || undefined,
      }
    }).then(res => res.data),
  })

  const categories = categoriesData?.results || []
  let products = productsData?.results || []

  // Filter in-stock if requested
  if (inStockOnly) {
    products = products.filter(p => {
      const primaryVariant = p.variants?.[0]
      const available = primaryVariant?.inventory?.available_quantity ?? 0
      return available > 0
    })
  }

  // Sort products
  if (sortBy === 'price-low') {
    products = [...products].sort((a, b) => (a.min_price || 0) - (b.min_price || 0))
  } else if (sortBy === 'price-high') {
    products = [...products].sort((a, b) => (b.min_price || 0) - (a.min_price || 0))
  } else if (sortBy === 'name') {
    products = [...products].sort((a, b) => a.name.localeCompare(b.name))
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (selectedCategory) params.set('category', selectedCategory.toString())
    router.push(`/products${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleCategorySelect = (catId: number | null) => {
    setSelectedCategory(catId)
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (catId) params.set('category', catId.toString())
    router.push(`/products${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleAddToCart = async (product: Product) => {
    if (!isAuthenticated) {
      toast.info('Please sign in to add items to your cart')
      router.push('/login?next=/products')
      return
    }

    const primaryVariant = product.variants?.[0]
    if (!primaryVariant) {
      toast.error('No variants available for this product')
      return
    }

    const available = primaryVariant.inventory?.available_quantity ?? 0
    if (available <= 0) {
      toast.error('This product is currently out of stock')
      return
    }

    try {
      setAddingVariantId(primaryVariant.id)
      await addItem(primaryVariant.id, 1)
      toast.success(`${product.name} added to cart!`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not add to cart')
    } finally {
      setAddingVariantId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Breadcrumb & Title */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">Products</span>
          {selectedCategory && (
            <>
              <span>/</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight">
              Product Catalog
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Showing {products.length} {products.length === 1 ? 'item' : 'items'} ready for express delivery
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); handleCategorySelect(selectedCategory) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button type="submit" className="btn-primary py-2 px-4 text-sm font-medium">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Category Pills & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-gray-200 dark:border-gray-800">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            In Stock Only
          </label>

          <div className="flex items-center gap-2">
            <ArrowUpDown size={15} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="default">Sort: Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Product Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg mt-4" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unable to Load Products</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            There was an error communicating with the backend API.
          </p>
          <button onClick={() => refetch()} className="btn-secondary text-sm py-2 px-4">
            Try Again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Package size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Products Found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search || selectedCategory
              ? "We couldn't find any products matching your search criteria."
              : "No active products are available in the catalog at this time."}
          </p>
          {(search || selectedCategory || inStockOnly) && (
            <button
              onClick={() => {
                setSearch('')
                setSelectedCategory(null)
                setInStockOnly(false)
                router.push('/products')
              }}
              className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const primaryVariant = product.variants?.[0]
            const availableStock = primaryVariant?.inventory?.available_quantity ?? 0
            const inStock = availableStock > 0
            const isLowStock = availableStock > 0 && availableStock <= 5
            const price = primaryVariant?.price_paise ?? (product.min_price ? product.min_price * 100 : 0)
            const originalPrice = primaryVariant?.original_price_paise
            const imageSrc = product.primary_image?.image || product.images?.[0]?.image

            return (
              <div 
                key={product.id}
                className="card flex flex-col overflow-hidden hover:shadow-md transition-shadow group border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                {/* Product Image Container */}
                <div className="relative aspect-square bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center p-6 overflow-hidden">
                  {imageSrc ? (
                    <img
                      src={getImageUrl(imageSrc)}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-gray-300 dark:text-gray-600 flex flex-col items-center gap-2">
                      <ShoppingBag size={48} strokeWidth={1.5} />
                      <span className="text-xs">No image</span>
                    </div>
                  )}

                  {/* Stock Badge */}
                  <div className="absolute top-3 right-3">
                    {inStock ? (
                      isLowStock ? (
                        <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                          Only {availableStock} left
                        </span>
                      ) : (
                        <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium">
                          In Stock
                        </span>
                      )
                    ) : (
                      <span className="badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Category Tag */}
                  {product.category_name && (
                    <div className="absolute top-3 left-3">
                      <span className="badge bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 backdrop-blur border border-gray-200 dark:border-gray-700 text-[10px]">
                        {product.category_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-base text-gray-950 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {product.description || 'Premium CloudMart catalog selection.'}
                    </p>
                  </div>

                  {/* Price & Action */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gray-950 dark:text-white">
                        {formatINR(price)}
                      </span>
                      {originalPrice && originalPrice > price && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatINR(originalPrice)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock || addingVariantId === primaryVariant?.id}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                        inStock
                          ? 'btn-primary'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {addingVariantId === primaryVariant?.id ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : inStock ? (
                        <>
                          <Plus size={15} /> Add to Cart
                        </>
                      ) : (
                        'Out of Stock'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-gray-500">Loading catalog...</div>}>
          <ProductsCatalog />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
