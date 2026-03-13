import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runScan } from '@/lib/scanner'

// Vercel Cron calls this endpoint every 3 hours
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret ?? ''}`

  // Constant-time comparison to prevent timing attacks on the cron secret
  const authorized =
    !!cronSecret &&
    authHeader.length === expected.length &&
    (() => {
      try {
        return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
      } catch {
        return false
      }
    })()

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScan('scheduled')
    return NextResponse.json(result)
  } catch (e: unknown) {
    // Don't leak internal error details to the caller
    const message = e instanceof Error ? e.message : 'Scan failed'
    console.error('[cron] Scheduled scan failed:', message)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
