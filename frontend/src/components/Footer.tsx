import Link from 'next/link'
import { ShoppingBag, ShieldCheck, Truck, Clock, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 transition-colors">
      {/* Value Propositions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Truck size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Free & Fast Delivery</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">On all orders above ₹499</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Secure Payments</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Instant UPI & Cash on Delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Clock size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">24/7 Dedicated Support</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ready to assist anytime</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Heart size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">100% Genuine Guarantee</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Directly sourced quality items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
              <ShoppingBag size={24} />
              CloudMart
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your trusted, modern e-commerce destination with seamless checkout, top-tier products, and instant UPI & COD payments.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-3">Shop</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/products" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">All Products</Link></li>
              <li><Link href="/products?category=electronics" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Electronics</Link></li>
              <li><Link href="/products?category=clothing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Fashion & Apparel</Link></li>
              <li><Link href="/products?category=home-kitchen" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home & Kitchen</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-3">Customer Service</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/account/orders" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Order History</Link></li>
              <li><Link href="/cart" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">My Cart</Link></li>
              <li><Link href="/account" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Account Settings</Link></li>
              <li><span className="text-gray-400 dark:text-gray-500">Shipping Policy (Free ₹499+)</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-3">Staff & Admin</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Admin Dashboard</Link></li>
              <li><Link href="/admin/products/new" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Add New Product</Link></li>
              <li><Link href="/admin/orders" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Manage Orders</Link></li>
              <li><Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Staff Login</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} CloudMart Technologies. All rights reserved.</p>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <span>Powered by Django REST + Next.js</span>
            <span>•</span>
            <span>Local Dev & Production Ready</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
