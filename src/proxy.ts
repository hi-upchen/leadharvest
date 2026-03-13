import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'rmm_session'
const SESSION_VALUE_LENGTH = 64 // HMAC-SHA256 hex = 64 chars

/**
 * Routes that don't need authentication.
 * Everything else (pages + API) requires a valid session.
 */
const PUBLIC_PATHS: (string | RegExp)[] = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reddit/callback', // receives OAuth redirect from Reddit
  '/api/cron/scan',            // has its own CRON_SECRET auth
  /^\/_next\//,
  /^\/favicon/,
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p =>
    typeof p === 'string' ? pathname === p || pathname.startsWith(p + '/') : p.test(pathname)
  )
}

function computeSessionToken(password: string): string {
  return createHmac('sha256', password).update('rmm-session-v1').digest('hex')
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const password = process.env.APP_PASSWORD
  // If APP_PASSWORD isn't configured, block everything except public paths
  if (!password) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Server misconfiguration: APP_PASSWORD not set' }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value

  // Full HMAC comparison in middleware — no partial checks, no deferred trust
  let valid = false
  if (typeof token === 'string' && token.length === SESSION_VALUE_LENGTH) {
    try {
      const expected = computeSessionToken(password)
      valid = timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      valid = false
    }
  }

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
