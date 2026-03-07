import { NextRequest, NextResponse } from 'next/server'
import { runScan } from '@/lib/scanner'

// Vercel Cron calls this endpoint every 3 hours
export async function GET(req: NextRequest) {
  // Vercel sends this header to verify the cron call is legitimate.
  // CRON_SECRET must always be set; reject if missing or mismatched.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScan('scheduled')
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    console.error('[cron] Scheduled scan failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
