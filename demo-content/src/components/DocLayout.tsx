import type { ReactNode } from 'react'
import Link from 'next/link'

interface NavItem {
  title: string
  href: string
}

interface Props {
  nav: NavItem[]
  children: ReactNode
}

export default function DocLayout({ nav, children }: Props) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-zinc-200 p-6">
        <Link href="/" className="block mb-8 text-lg font-semibold text-zinc-900">
          Acme Docs
        </Link>
        <nav className="space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-12 max-w-3xl">
        {children}
      </main>
    </div>
  )
}
