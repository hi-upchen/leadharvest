import { NextResponse } from 'next/server'
import { runScan } from '@/lib/scanner'

export async function POST() {
  try {
    const result = await runScan('manual')
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
