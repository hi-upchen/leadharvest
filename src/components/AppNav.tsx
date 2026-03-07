'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Queue' },
  { href: '/scan', label: 'Scan' },
  { href: '/history', label: 'History' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings/products', label: 'Products' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/reddit', label: 'Reddit' },
]

export function AppNav() {
  const path = usePathname()

  // Don't show nav on login page
  if (path === '/login') return null

  return (
    <nav className="border-b px-4 py-3 flex gap-4 text-sm overflow-x-auto">
      <span className="font-bold mr-2 shrink-0 text-foreground">📊 RMM</span>
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={`shrink-0 ${
            path === l.href || (l.href !== '/' && path.startsWith(l.href))
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.label}
        </Link>
      ))}
      <div className="ml-auto shrink-0">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground text-xs"
            onClick={async e => {
              e.preventDefault()
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/login'
            }}
          >
            Logout
          </button>
        </form>
      </div>
    </nav>
  )
}
