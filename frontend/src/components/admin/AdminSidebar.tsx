'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Overview', href: '/admin' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Add product', href: '/admin/products/new' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Order history', href: '/admin/orders/history' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Settings', href: '/admin/settings' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="card p-4 flex md:grid flex-wrap items-center gap-2">
      <strong className="text-sm font-bold text-[var(--cm-ink)] px-2 py-1 w-full md:w-auto">
        Cloud<span className="text-[var(--cm-link)]">Mart</span> Admin
      </strong>
      {navItems.map(({ label, href }) => {
        const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`px-2.5 py-2 rounded-md text-sm transition-colors no-underline ${
              isActive
                ? 'font-bold bg-[var(--cm-tint)] text-[var(--cm-link)]'
                : 'text-[var(--cm-ink)] hover:bg-[var(--cm-tint)]'
            }`}
          >
            {label}
          </Link>
        )
      })}
      <Link
        href="/"
        className="px-2.5 py-2 rounded-md text-xs text-[var(--cm-muted)] hover:text-[var(--cm-link)] md:mt-2 md:border-t md:border-[var(--cm-line)] md:pt-3"
      >
        ← Back to store
      </Link>
    </aside>
  )
}
