'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { Product } from '@/types'
import { useCartStore, useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export default function HomePage() {
  const router = useRouter()
  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [addingId, setAddingId] = useState<number | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // Fetch Public Products from Django REST API
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<{ count: number; results: Product[] }>({
    queryKey: ['public-products-home'],
    queryFn: () => api.get('/products/').then((res) => res.data),
  })

  const products = productsData?.results || []
  const slideProducts = products

  // Auto-advance hero slides every 5 seconds unless paused or <= 1 product
  useEffect(() => {
    if (isPaused || slideProducts.length <= 1) return
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideProducts.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isPaused, slideProducts.length])

  // Keep activeSlide in bounds if product count changes
  useEffect(() => {
    if (activeSlide >= slideProducts.length && slideProducts.length > 0) {
      setActiveSlide(0)
    }
  }, [activeSlide, slideProducts.length])

  const handlePrevSlide = () => {
    if (slideProducts.length <= 1) return
    setActiveSlide((prev) => (prev - 1 + slideProducts.length) % slideProducts.length)
  }

  const handleNextSlide = () => {
    if (slideProducts.length <= 1) return
    setActiveSlide((prev) => (prev + 1) % slideProducts.length)
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
      setAddingId(product.id)
      await addItem(primaryVariant.id, 1)
      toast.success(`${product.name} added to cart.`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not add to cart')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />

      <main className="flex-1 cm-container w-full py-7">
        {/* Movable Hero Product Slides */}
        <section
          aria-label="Featured products slider"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative bg-[#d5ebff] text-[#132242] rounded-[20px] overflow-hidden mb-7"
        >
          {slideProducts.length > 0 ? (
            <>
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {slideProducts.map((product) => {
                  const slideImg = product.primary_image?.image || product.images?.[0]?.image
                  const price = product.min_price || product.variants?.[0]?.price_paise || 0

                  return (
                    <div
                      key={product.id}
                      className="w-full shrink-0 grid grid-cols-1 md:grid-cols-2 items-center"
                    >
                      <div className="p-6 sm:p-10 lg:p-14 pb-12 sm:pb-14">
                        <small className="block text-sm font-semibold text-[#394d65]">
                          {product.category_name} · {formatINR(price)}
                        </small>
                        <h1 className="text-[clamp(1.85rem,4vw,3.1rem)] font-extrabold text-[#132242] leading-[1.12] tracking-[-0.035em] my-4 line-clamp-2">
                          {product.name}
                        </h1>
                        <p className="text-[#394d65] text-sm sm:text-base mb-6 max-w-md line-clamp-2">
                          {product.description || 'Discover top-rated electronics, apparel, lifestyle essentials and more with instant UPI & COD checkout.'}
                        </p>
                        <Link
                          href={`/products?search=${encodeURIComponent(product.name)}`}
                          className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-1.5 no-underline"
                        >
                          View product →
                        </Link>
                      </div>
                      <img
                        src={slideImg ? getImageUrl(slideImg) : '/cloudmart-images/hero.webp'}
                        alt={product.name}
                        className={`w-full h-[180px] sm:h-[260px] md:h-[335px] block ${
                          slideImg ? 'object-contain bg-white/70 p-4' : 'object-cover'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Previous / Next Controls */}
              {slideProducts.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous product slide"
                    onClick={handlePrevSlide}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-[#132242] shadow-md flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next product slide"
                    onClick={handleNextSlide}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-[#132242] shadow-md flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Slide Indicator Dots */}
                  <div className="absolute bottom-3.5 left-6 sm:left-10 lg:left-14 flex items-center gap-2">
                    {slideProducts.map((product, idx) => (
                      <button
                        key={product.id}
                        type="button"
                        aria-label={`Go to slide ${idx + 1}: ${product.name}`}
                        onClick={() => setActiveSlide(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === activeSlide
                            ? 'w-6 bg-[#204dd5]'
                            : 'w-2 bg-[#132242]/25 hover:bg-[#132242]/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="p-6 sm:p-10 lg:p-14">
                <small className="block text-sm font-semibold text-[#394d65]">Featured Selection</small>
                <h1 className="text-[clamp(1.85rem,4vw,3.1rem)] font-extrabold text-[#132242] leading-[1.12] tracking-[-0.035em] my-4">
                  Effortless Shopping with CloudMart
                </h1>
                <p className="text-[#394d65] text-sm sm:text-base mb-6 max-w-md">
                  Discover top-rated electronics, apparel, lifestyle essentials and more with instant UPI & COD checkout.
                </p>
                <Link href="/products" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-1.5 no-underline">
                  Shop all products →
                </Link>
              </div>
              <img
                src="/cloudmart-images/hero.webp"
                alt="CloudMart Featured"
                className="w-full h-[180px] sm:h-[260px] md:h-[335px] object-cover block"
              />
            </div>
          )}
        </section>

        {/* Product Grid Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[1.65rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em]">
            Shop all products
          </h2>
          <Link href="/products" className="text-sm font-semibold text-[var(--cm-link)] hover:underline">
            Browse catalog →
          </Link>
        </div>

        {/* Products */}
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-[18px]">
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
        ) : productsError ? (
          <div className="panel text-center py-10">
            <p className="text-red-500 font-semibold mb-1">Failed to load products from the backend API.</p>
            <p className="text-sm text-[var(--cm-muted)]">Please verify the backend server is running and try again.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="panel text-center py-10">
            <p className="text-[var(--cm-muted)]">No matching products found in the catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-[18px]">
            {products.map((product) => {
              const primaryVariant = product.variants?.[0]
              const price = product.min_price || primaryVariant?.price_paise || 0
              const available = primaryVariant?.inventory?.available_quantity ?? 0
              const isInStock = available > 0
              const imageSrc = product.primary_image?.image || product.images?.[0]?.image

              return (
                <article
                  key={product.id}
                  className="card p-3 sm:p-3.5 flex flex-col gap-2"
                >
                  <Link href={`/products?search=${encodeURIComponent(product.name)}`} className="block group no-underline">
                    {imageSrc ? (
                      <img
                        src={getImageUrl(imageSrc)}
                        alt={product.name}
                        className="w-full aspect-[1.55] object-contain bg-white rounded-[9px] block"
                      />
                    ) : (
                      <span className="w-full aspect-[1.55] grid place-items-center bg-[var(--cm-tint)] text-[var(--cm-muted)] rounded-[9px] text-xs font-medium px-2 text-center">
                        {product.category_name}
                      </span>
                    )}
                    <small className="block text-xs text-[var(--cm-muted)] mt-3">
                      {product.category_name}
                    </small>
                    <h3 className="text-base font-bold text-[var(--cm-ink)] mt-1 line-clamp-1 group-hover:underline">
                      {product.name}
                    </h3>
                  </Link>

                  <strong className="text-base font-bold text-[var(--cm-ink)]">
                    {formatINR(price)}
                  </strong>

                  <button
                    type="button"
                    disabled={!isInStock || addingId === product.id}
                    onClick={() => handleQuickAddToCart(product)}
                    className="btn-primary w-full text-sm mt-auto py-2.5"
                  >
                    {addingId === product.id
                      ? 'Adding…'
                      : isInStock
                        ? 'Add to cart'
                        : 'Out of stock'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
