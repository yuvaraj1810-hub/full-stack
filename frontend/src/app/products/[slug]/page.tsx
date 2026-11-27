'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { api, formatINR, getImageUrl } from '@/lib/api'
import { Product } from '@/types'
import { useCartStore, useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params?.slug === 'string' ? params.slug : ''

  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [imgFailed, setImgFailed] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)

  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ['product-detail', slug],
    queryFn: () => api.get(`/products/${slug}/`).then((res) => res.data),
    enabled: Boolean(slug),
  })

  useEffect(() => {
    if (product?.variants?.length) {
      const firstInStock = product.variants.find(
        (v) => v.is_active && (v.inventory?.available_quantity ?? v.stock_quantity ?? 0) > 0
      )
      setSelectedVariantId((firstInStock || product.variants[0]).id)
      setQuantity(1)
      setSelectedImageIdx(0)
      setImgFailed(false)
    }
  }, [product])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
        <Navbar />
        <main className="flex-1 cm-container w-full py-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse">
            <div className="panel h-[380px] bg-[var(--cm-tint)]" />
            <div className="panel space-y-4">
              <div className="h-4 bg-[var(--cm-tint)] rounded w-1/4" />
              <div className="h-8 bg-[var(--cm-tint)] rounded w-3/4" />
              <div className="h-6 bg-[var(--cm-tint)] rounded w-1/3" />
              <div className="h-20 bg-[var(--cm-tint)] rounded w-full" />
              <div className="h-11 bg-[var(--cm-tint)] rounded w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
        <Navbar />
        <main className="flex-1 cm-container w-full py-12 space-y-4">
          <div className="panel max-w-lg mx-auto text-center space-y-3">
            <h1 className="text-2xl font-bold text-[var(--cm-ink)]">Product not found</h1>
            <p className="text-sm text-[var(--cm-muted)]">
              This product may have been removed or is currently unavailable.
            </p>
            <Link href="/products" className="btn-primary text-sm no-underline inline-flex">
              ← Back to products
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Build ordered image list (primary_image first, then remaining unique images)
  const rawImages = product.images || []
  const orderedImages = product.primary_image
    ? [product.primary_image, ...rawImages.filter((img) => img.id !== product.primary_image?.id)]
    : rawImages
  const activeImage = orderedImages[selectedImageIdx] || orderedImages[0] || null

  const activeVariants = (product.variants || []).filter((v) => v.is_active !== false)
  const selectedVariant =
    activeVariants.find((v) => v.id === selectedVariantId) || activeVariants[0] || null

  const availableStock = selectedVariant
    ? (selectedVariant.inventory?.available_quantity ?? selectedVariant.stock_quantity ?? 0)
    : 0
  const inStock = Boolean(selectedVariant) && availableStock > 0

  const pricePaise = selectedVariant?.price_paise ?? product.min_price ?? 0
  const originalPricePaise = selectedVariant?.original_price_paise ?? null
  const hasDiscount = Boolean(originalPricePaise && originalPricePaise > pricePaise)
  const discountPercent =
    selectedVariant?.discount_percent ||
    (hasDiscount && originalPricePaise
      ? Math.round((1 - pricePaise / originalPricePaise) * 100)
      : 0)

  const formatAttributes = (attrs?: Record<string, string>) => {
    if (!attrs || Object.keys(attrs).length === 0) return null
    return Object.entries(attrs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
  }

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to add items to your cart')
      router.push(`/login?next=/products/${product.slug}`)
      return
    }
    if (!selectedVariant || !inStock) {
      toast.error('This product variant is currently out of stock')
      return
    }

    try {
      setAdding(true)
      await addItem(selectedVariant.id, quantity)
      toast.success(`${product.name} (${quantity}) added to cart.`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not add item to cart')
    } finally {
      setAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to continue to checkout')
      router.push(`/login?next=/products/${product.slug}`)
      return
    }
    if (!selectedVariant || !inStock) {
      toast.error('This product variant is currently out of stock')
      return
    }

    try {
      setBuying(true)
      await addItem(selectedVariant.id, quantity)
      router.push('/checkout')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not proceed to checkout')
      setBuying(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cm-bg)] text-[var(--cm-ink)]">
      <Navbar />

      <main className="flex-1 cm-container w-full py-7">
        {/* Category Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
          <Link href="/products" className="text-[var(--cm-link)] font-semibold hover:underline">
            ← All products
          </Link>
          {product.category_name && (
            <>
              <span className="text-[var(--cm-muted)]">/</span>
              <Link
                href={`/products?category=${product.category}`}
                className="text-[var(--cm-link)] font-semibold hover:underline"
              >
                {product.category_name}
              </Link>
            </>
          )}
        </div>

        {/* Detail Grid (.detail) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left Panel: Image Gallery */}
          <div className="panel space-y-3">
            {activeImage && !imgFailed ? (
              <img
                src={getImageUrl(activeImage.image)}
                alt={activeImage.alt_text || product.name}
                onError={() => setImgFailed(true)}
                className="w-full max-h-[470px] aspect-[1.2] object-contain bg-white rounded-[10px] block p-3"
              />
            ) : (
              <div className="w-full aspect-[1.2] max-h-[420px] grid place-items-center bg-[var(--cm-tint)] text-[var(--cm-muted)] rounded-[10px] text-sm font-medium">
                {product.category_name || 'No image available'}
              </div>
            )}

            {orderedImages.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-1">
                {orderedImages.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setSelectedImageIdx(idx)
                      setImgFailed(false)
                    }}
                    className={`w-16 h-16 rounded-lg bg-white p-1 border-2 shrink-0 cursor-pointer overflow-hidden ${
                      idx === selectedImageIdx ? 'border-[var(--cm-blue)]' : 'border-[var(--cm-line)]'
                    }`}
                  >
                    <img
                      src={getImageUrl(img.image)}
                      alt={img.alt_text || `${product.name} ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Details & Purchase Controls */}
          <section className="panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <small className="text-sm font-semibold text-[var(--cm-muted)]">
                {product.category_name}
              </small>
              <span
                className={`badge ${
                  inStock
                    ? availableStock <= 5
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : 'bg-green-500/15 text-green-700 dark:text-green-300'
                    : 'bg-red-500/15 text-red-600 dark:text-red-300'
                }`}
              >
                {inStock
                  ? availableStock <= 5
                    ? `Only ${availableStock} left`
                    : `${availableStock} available`
                  : 'Out of stock'}
              </span>
            </div>

            <h1 className="text-[1.75rem] sm:text-[2.25rem] font-bold text-[var(--cm-ink)] tracking-[-0.035em] leading-[1.15]">
              {product.name}
            </h1>

            {/* Price & Discount */}
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--cm-ink)] m-0">
                {formatINR(pricePaise)}
              </h2>
              {hasDiscount && originalPricePaise && (
                <>
                  <span className="text-base text-[var(--cm-muted)] line-through">
                    {formatINR(originalPricePaise)}
                  </span>
                  {discountPercent > 0 && (
                    <span className="badge">{discountPercent}% OFF</span>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            {product.description ? (
              <p className="text-sm sm:text-base text-[var(--cm-muted)] leading-relaxed">
                {product.description}
              </p>
            ) : (
              <p className="text-sm text-[var(--cm-muted)]">
                Genuine CloudMart catalog product.
              </p>
            )}

            {/* Variants */}
            {activeVariants.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--cm-line)]">
                <span className="block text-sm font-semibold text-[var(--cm-ink)]">
                  {activeVariants.length > 1 ? 'Select option' : 'Variant'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((variant) => {
                    const attrText = formatAttributes(variant.attributes)
                    const label = attrText || variant.sku
                    const isSelected = variant.id === selectedVariant?.id
                    const vStock = variant.inventory?.available_quantity ?? variant.stock_quantity ?? 0
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id)
                          setQuantity(1)
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--cm-tint)] text-[var(--cm-link)] border-[var(--cm-blue)]'
                            : 'bg-[var(--cm-surface)] text-[var(--cm-ink)] border-[var(--cm-line)] hover:border-[var(--cm-link)]'
                        } ${vStock <= 0 ? 'opacity-60' : ''}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SKU */}
            {selectedVariant && (
              <p className="text-xs sm:text-sm text-[var(--cm-muted)] font-mono">
                SKU · {selectedVariant.sku}
              </p>
            )}

            {/* Quantity & Action Buttons */}
            <div className="pt-3 border-t border-[var(--cm-line)] space-y-4">
              {inStock && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--cm-ink)]">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="btn-secondary py-1.5 px-3 text-sm"
                    >
                      −
                    </button>
                    <b className="text-sm font-bold min-w-[28px] text-center">{quantity}</b>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={quantity >= availableStock}
                      onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                      className="btn-secondary py-1.5 px-3 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!inStock || adding || buying}
                  onClick={handleAddToCart}
                  className="btn-primary flex-1 min-w-[140px] py-3 text-sm"
                >
                  {adding ? 'Adding…' : inStock ? 'Add to cart' : 'Out of stock'}
                </button>
                <button
                  type="button"
                  disabled={!inStock || adding || buying}
                  onClick={handleBuyNow}
                  className="btn-secondary flex-1 min-w-[140px] py-3 text-sm"
                >
                  {buying ? 'Redirecting…' : 'Buy now'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
