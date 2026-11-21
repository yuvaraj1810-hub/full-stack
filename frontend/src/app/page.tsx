'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { 
  ShoppingBag, 
  Search, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Tag, 
  ShieldCheck, 
  CreditCard, 
  Package, 
  AlertCircle,
  Plus
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { Product, Category } from '@/types'
import { useCartStore, useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export default function HomePage() {
  const router = useRouter()
  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)

  // Fetch Categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ results: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories/').then(res => res.data),
  })

  // Fetch Public Products
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<{ count: number; results: Product[] }>({
    queryKey: ['public-products', selectedCategory],
    queryFn: () => api.get('/products/', {
      params: {
        category: selectedCategory || undefined,
      }
    }).then(res => res.data),
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleQuickAddToCart = async (product: Product) => {
    if (!isAuthenticated) {
      toast.info('Please sign in to add items to your cart')
      router.push('/login?next=/')
      return
    }

    const primaryVariant = product.variants?.[0]
    if (!primaryVariant) {
      toast.error('No variants available for this product')
      return
    }

    const available = primaryVariant.inventory?.available_quantity ?? 0
    if (available <= 0) {
      toast.error('Sorry, this product is currently out of stock')
      return
    }

    try {
      await addItem(primaryVariant.id, 1)
      toast.success(`${product.name} added to cart!`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not add to cart')
    }
  }

  const products = productsData?.results || []
  const featuredProducts = products.slice(0, 4)
  const newArrivals = products.slice(2, 6)

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-transparent dark:from-gray-900 dark:via-gray-950 dark:to-transparent border-b border-gray-100 dark:border-gray-800 py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={14} /> Premium E-Commerce Experience
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 dark:text-white leading-[1.15]">
                  Effortless Shopping with <span className="text-blue-600 dark:text-blue-400">CloudMart</span>
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  Discover top-rated electronics, apparel, lifestyle essentials and more. Featuring seamless Cash on Delivery (COD) and instantaneous UPI test checkout.
                </p>

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="max-w-xl flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      className="input-field pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm text-sm"
                      placeholder="Search headphones, t-shirts, electronics..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-primary py-3 px-6 text-sm flex items-center gap-2 shadow-sm">
                    Search
                  </button>
                </form>

                {/* Quick Highlights */}
                <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-green-500" /> Free Returns</span>
                  <span className="flex items-center gap-1.5"><CreditCard size={16} className="text-blue-500" /> Instant UPI & COD</span>
                  <span className="flex items-center gap-1.5"><Package size={16} className="text-indigo-500" /> Real-time Inventory</span>
                </div>
              </div>

              {/* Hero Banner Showcase Card */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-30 dark:opacity-40 animate-pulse" />
                  <div className="relative card p-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-gray-200/80 dark:border-gray-800">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Special Showcase</span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">Top-Tier Sound & Comfort</h3>
                      </div>
                      <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-semibold">
                        In Stock
                      </span>
                    </div>

                    <div className="py-6 flex items-center justify-center">
                      <div className="w-48 h-48 rounded-xl bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                        <ShoppingBag size={72} strokeWidth={1.5} />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">Wireless Headphones</span>
                        <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatINR(199900)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Crystal-clear acoustic audio with active noise isolation and ergonomic 30-hour battery life.
                      </p>
                      <Link href="/products" className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
                        Explore Full Catalog <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Shop by Category</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Browse handpicked collections</p>
            </div>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear Filter (Show All)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`p-4 rounded-xl border text-center transition-all ${
                selectedCategory === null 
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm' 
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Tag size={18} />
              </div>
              <span className="text-xs">All Items</span>
            </button>

            {categoriesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
              ))
            ) : (
              categoriesData?.results?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    selectedCategory === cat.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300">
                    <ShoppingBag size={18} />
                  </div>
                  <span className="text-xs truncate block">{cat.name}</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Featured Products Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
                <TrendingUp size={14} /> Highly Recommended
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white mt-1">Featured Products</h2>
            </div>
            <Link href="/products" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              View all <ArrowRight size={16} />
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3 animate-pulse">
                  <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : productsError ? (
            <div className="card p-8 text-center text-red-500 dark:text-red-400 space-y-2">
              <AlertCircle className="mx-auto" size={32} />
              <p className="font-semibold text-sm">Failed to connect to CloudMart product API.</p>
              <p className="text-xs text-gray-500">Ensure the backend server is running at port 8000.</p>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="card p-12 text-center text-gray-500 dark:text-gray-400 space-y-3">
              <Package className="mx-auto opacity-50" size={44} />
              <p className="text-base font-semibold">No products found in this category.</p>
              <p className="text-xs">Log in as admin to add new products to the catalog.</p>
              <Link href="/admin/products/new" className="btn-primary text-xs inline-flex items-center gap-1.5 mt-2">
                <Plus size={14} /> Add Product in Admin
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => {
                const primaryVariant = product.variants?.[0]
                const price = product.min_price || primaryVariant?.price_paise || 0
                const available = primaryVariant?.inventory?.available_quantity ?? 0
                const isInStock = available > 0

                return (
                  <div key={product.id} className="card overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      {/* Product Image / Placeholder */}
                      <div className="h-48 bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center overflow-hidden">
                        {product.primary_image ? (
                          <img 
                            src={getImageUrl(product.primary_image.image)} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-gray-400 dark:text-gray-600 flex flex-col items-center gap-2">
                            <ShoppingBag size={36} />
                            <span className="text-[10px] font-mono uppercase tracking-wider">{product.category_name}</span>
                          </div>
                        )}
                        <span className={`absolute top-2.5 right-2.5 badge ${
                          isInStock ? 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                        }`}>
                          {isInStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-1.5">
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {product.category_name}
                        </span>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <Link href={`/products`}>
                            {product.name}
                          </Link>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {product.description || 'Premium quality e-commerce item verified by CloudMart.'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 mt-2">
                      <div>
                        <span className="text-xs text-gray-400 block">Price</span>
                        <span className="font-bold text-base text-gray-950 dark:text-white">
                          {formatINR(price)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleQuickAddToCart(product)}
                        disabled={!isInStock}
                        className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 shrink-0"
                      >
                        <ShoppingBag size={14} /> Add
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Promotion Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 sm:p-10 shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-xl space-y-4">
              <span className="badge bg-white/20 text-white text-xs font-semibold backdrop-blur">
                Limited Time Offer
              </span>
              <h2 className="text-3xl font-extrabold sm:text-4xl tracking-tight">
                Seamless Checkout with UPI & Cash on Delivery
              </h2>
              <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
                Experience risk-free ordering with instant verified tracking, guaranteed dispatch, and flexible checkout options.
              </p>
              <div className="pt-2">
                <Link href="/products" className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-6 py-3 rounded-lg text-sm shadow transition-colors">
                  Shop Now <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 flex items-center justify-center pointer-events-none">
              <ShoppingBag size={300} />
            </div>
          </div>
        </section>

        {/* New Arrivals Section */}
        {newArrivals.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={14} /> Just Added
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white mt-1">New Arrivals</h2>
              </div>
              <Link href="/products" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                See all items <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newArrivals.map((product) => {
                const primaryVariant = product.variants?.[0]
                const price = product.min_price || primaryVariant?.price_paise || 0
                const available = primaryVariant?.inventory?.available_quantity ?? 0
                const isInStock = available > 0

                return (
                  <div key={product.id} className="card overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="h-44 bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center overflow-hidden">
                        {product.primary_image ? (
                          <img 
                            src={getImageUrl(product.primary_image.image)} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-gray-400 dark:text-gray-600 flex flex-col items-center gap-1.5">
                            <Package size={34} />
                            <span className="text-[10px] font-mono">{product.category_name}</span>
                          </div>
                        )}
                        <span className={`absolute top-2.5 right-2.5 badge ${
                          isInStock ? 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                        }`}>
                          {isInStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      <div className="p-4 space-y-1.5">
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {product.category_name}
                        </span>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {product.description || 'Authentic CloudMart certified item.'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 mt-2">
                      <span className="font-bold text-base text-gray-950 dark:text-white">
                        {formatINR(price)}
                      </span>
                      <button
                        onClick={() => handleQuickAddToCart(product)}
                        disabled={!isInStock}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Add to Cart
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
