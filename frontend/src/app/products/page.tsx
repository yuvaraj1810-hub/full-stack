'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  const [sortBy, setSortBy] = useState<string>('')
  const [maxPriceInr, setMaxPriceInr] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [addingVariantId, setAddingVariantId] = useState<number | null>(null)

  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setSelectedCategory(searchParams.get('category') ? Number(searchParams.get('category')) : null)
  }, [searchParams])

  // Fetch Categories
  const { data: categoriesData } = useQuery<{ results: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories/').then((res) => res.data),
  })

  // Fetch Products
  const { data: productsData, isLoading, isError, refetch } = useQuery<PaginatedResponse<Product>>({
    queryKey: ['products-catalog', selectedCategory, search],
    queryFn: () =>
      api
        .get('/products/', {
          params: {
            category: selectedCategory || undefined,
            search: search.trim() || undefined,
          },
        })
        .then((res) => res.data),
  })

  const categories = categoriesData?.results || []
  let products = productsData?.results || []

  // Filter by max price (INR)
  if (maxPriceInr && Number(maxPriceInr) > 0) {
    const maxPaise = Number(maxPriceInr) * 100
    products = products.filter((p) => {
      const price = p.min_price ?? p.variants?.[0]?.price_paise ?? 0
      return price <= maxPaise
    })
  }

  // Filter in-stock
  if (inStockOnly) {
    products = products.filter((p) => {
      const available = p.variants?.[0]?.inventory?.available_quantity ?? 0
      return available > 0
    })
  }

  // Sort products
  if (sortBy === 'low') {
    products = [...products].sort((a, b) => (a.min_price || 0) - (b.min_price || 0))
  } else if (sortBy === 'high') {
    products = [...products].sort((a, b) => (b.min_price || 0) - (a.min_price || 0))
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
      toast.success(`${product.name} added to cart.`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not add to cart')
    } finally {
      setAddingVariantId(null)
    }
  }

  const activeCategoryName = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.name
    : null

  const heading = activeCategoryName
    ? activeCategoryName
    : search.trim()
      ? `Results for “${search.trim()}”`
      : 'Shop all products'

  return (
    <div className="cm-container w-full py-7">
      <h1 className="text-[1.85rem] sm:text-[2.2rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] mb-4">
        {heading}
      </h1>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end mb-6">
        <label className="grid gap-1.5 text-sm font-semibold text-[var(--cm-ink)]">
          <span>Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field text-sm"
          >
            <option value="">Featured</option>
            <option value="low">Price, low to high</option>
            <option value="high">Price, high to low</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-[var(--cm-ink)]">
          <span>Maximum price (₹)</span>
          <input
            type="number"
            min="0"
            placeholder="Any price"
            value={maxPriceInr}
            onChange={(e) => setMaxPriceInr(e.target.value)}
            className="input-field text-sm"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-[var(--cm-ink)]">
          <span>Category</span>
          <select
            value={selectedCategory ?? ''}
            onChange={(e) => handleCategorySelect(e.target.value ? Number(e.target.value) : null)}
            className="input-field text-sm"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2.5 py-2.5 text-sm font-semibold text-[var(--cm-ink)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 accent-[var(--cm-blue)] rounded"
          />
          <span>In stock only</span>
        </label>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-[18px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-3.5 animate-pulse flex flex-col gap-2">
              <div className="w-full aspect-[1.55] bg-[var(--cm-tint)] rounded-[9px]" />
              <div className="h-3 bg-[var(--cm-tint)] rounded w-1/3 mt-2" />
              <div className="h-4 bg-[var(--cm-tint)] rounded w-3/4" />
              <div className="h-4 bg-[var(--cm-tint)] rounded w-1/4" />
              <div className="h-9 bg-[var(--cm-tint)] rounded-lg mt-2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="panel text-center py-10 space-y-3">
          <p className="text-red-500 font-semibold">Unable to load products from the backend API.</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary text-sm">
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="panel text-center py-10 space-y-3">
          <p className="text-[var(--cm-muted)]">No matching products.</p>
          {(search || selectedCategory || inStockOnly || maxPriceInr) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedCategory(null)
                setInStockOnly(false)
                setMaxPriceInr('')
                setSortBy('')
                router.push('/products')
              }}
              className="btn-secondary text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-[18px]">
          {products.map((product) => {
            const primaryVariant = product.variants?.[0]
            const availableStock = primaryVariant?.inventory?.available_quantity ?? 0
            const inStock = availableStock > 0
            const price = primaryVariant?.price_paise ?? (product.min_price || 0)
            const imageSrc = product.primary_image?.image || product.images?.[0]?.image

            return (
              <article key={product.id} className="card p-2.5 sm:p-3.5 flex flex-col gap-2 min-w-0">
                <Link href={`/products/${product.slug}`} className="block group no-underline min-w-0">
                  {imageSrc ? (
                    <img
                      src={getImageUrl(imageSrc)}
                      alt={product.name}
                      className="w-full aspect-[1.55] object-contain bg-white rounded-[9px] block p-1"
                    />
                  ) : (
                    <span className="w-full aspect-[1.55] grid place-items-center bg-[var(--cm-tint)] text-[var(--cm-muted)] rounded-[9px] text-xs font-medium px-2 text-center">
                      {product.category_name}
                    </span>
                  )}
                  <small className="block text-[11px] sm:text-xs text-[var(--cm-muted)] mt-2.5 truncate">
                    {product.category_name}
                  </small>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--cm-ink)] mt-1 line-clamp-1 group-hover:underline">
                    {product.name}
                  </h3>
                </Link>

                <strong className="text-sm sm:text-base font-bold text-[var(--cm-ink)]">
                  {formatINR(price)}
                </strong>

                <button
                  type="button"
                  disabled={!inStock || addingVariantId === primaryVariant?.id}
                  onClick={() => handleAddToCart(product)}
                  className="btn-primary w-full text-xs sm:text-sm mt-auto py-2 sm:py-2.5"
                >
                  {addingVariantId === primaryVariant?.id
                    ? 'Adding…'
                    : inStock
                      ? 'Add to cart'
                      : 'Out of stock'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'

export default function ProductsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="cm-container py-16 text-center text-sm text-[var(--cm-muted)]">
              Loading CloudMart…
            </div>
          }
        >
          <ProductsCatalog />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
