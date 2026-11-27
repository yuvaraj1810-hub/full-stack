import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-[var(--cm-line)] mt-8 bg-[var(--cm-bg)]">
      <div className="cm-container py-5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <span className="font-bold text-[var(--cm-ink)]">
          Cloud<span className="text-[var(--cm-link)]">Mart</span>
        </span>
        <div className="flex items-center gap-5 text-[var(--cm-muted)]">
          <Link href="/products" className="text-[var(--cm-link)] hover:underline">
            Catalog
          </Link>
          <Link href="/account/orders" className="text-[var(--cm-link)] hover:underline">
            My orders
          </Link>
          <Link href="/admin" className="text-[var(--cm-link)] hover:underline">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}
